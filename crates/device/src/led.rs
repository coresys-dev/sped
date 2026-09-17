use crate::surface::DeviceError;
use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use std::sync::mpsc::Sender;
use std::sync::Mutex;

/// Physical controls whose LED the *host* can drive. Not every lit key on
/// the device is one of these -- SOURCE/TIMELINE and the transport/trim
/// keys genuinely have no LED at all, but SHTL/JOG/SCRL *do* have one
/// (confirmed on real hardware: the device highlights whichever wheel
/// mode is active). It just isn't one of these: the output report's LED
/// bitfield is a fixed 32 bits (see `crate::vendor`'s `light_leds`), bits
/// 0-17 are this enum's, and bits 18-31 were exhaustively probed via the
/// DevPanel's raw-bit tester against real hardware with no effect on
/// SHTL/JOG/SCRL -- so that indicator is driven autonomously by the
/// device's own firmware, not exposed to the host at all. Bit positions
/// for the controls below match the output report format exactly
/// (`SpeedEditorLed` in `smunaut/blackmagic-misc`, Apache-2.0), so
/// `crate::vendor` can use `bit()` directly with no separate LED-id enum
/// of its own.
///
/// `Serialize`/`Deserialize` are hand-written against [`LedId::as_str`]
/// rather than derived with `#[serde(rename_all = "kebab-case")]`, for the
/// same reason as `ControlId` (see its doc comment in `control.rs`):
/// serde's automatic case conversion doesn't hyphenate before a digit
/// (`Cam1` -> `"cam1"`, not `"cam-1"`), which silently desynced every
/// `CamN` id from the frontend's hardcoded `"cam-N"` strings -- the Tauri
/// `set_led`/`clear_leds` IPC call would fail to deserialize the argument
/// and throw, silently swallowed by the dev panel's `catch {}`, so CAM
/// LEDs looked like they just didn't respond to clicks at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LedId {
    CloseUp,
    Cut,
    Dis,
    SmthCut,
    TransTitle,
    Snap,
    Cam7,
    Cam8,
    Cam9,
    LiveOwr,
    Cam4,
    Cam5,
    Cam6,
    VideoOnly,
    Cam1,
    Cam2,
    Cam3,
    AudioOnly,
}

impl LedId {
    pub const ALL: &'static [LedId] = &[
        LedId::CloseUp,
        LedId::Cut,
        LedId::Dis,
        LedId::SmthCut,
        LedId::TransTitle,
        LedId::Snap,
        LedId::Cam7,
        LedId::Cam8,
        LedId::Cam9,
        LedId::LiveOwr,
        LedId::Cam4,
        LedId::Cam5,
        LedId::Cam6,
        LedId::VideoOnly,
        LedId::Cam1,
        LedId::Cam2,
        LedId::Cam3,
        LedId::AudioOnly,
    ];

    pub fn bit(self) -> u32 {
        match self {
            LedId::CloseUp => 0,
            LedId::Cut => 1,
            LedId::Dis => 2,
            LedId::SmthCut => 3,
            LedId::TransTitle => 4,
            LedId::Snap => 5,
            LedId::Cam7 => 6,
            LedId::Cam8 => 7,
            LedId::Cam9 => 8,
            LedId::LiveOwr => 9,
            LedId::Cam4 => 10,
            LedId::Cam5 => 11,
            LedId::Cam6 => 12,
            LedId::VideoOnly => 13,
            LedId::Cam1 => 14,
            LedId::Cam2 => 15,
            LedId::Cam3 => 16,
            LedId::AudioOnly => 17,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            LedId::CloseUp => "close-up",
            LedId::Cut => "cut",
            LedId::Dis => "dis",
            LedId::SmthCut => "smth-cut",
            LedId::TransTitle => "trans-title",
            LedId::Snap => "snap",
            LedId::Cam7 => "cam-7",
            LedId::Cam8 => "cam-8",
            LedId::Cam9 => "cam-9",
            LedId::LiveOwr => "live-owr",
            LedId::Cam4 => "cam-4",
            LedId::Cam5 => "cam-5",
            LedId::Cam6 => "cam-6",
            LedId::VideoOnly => "video-only",
            LedId::Cam1 => "cam-1",
            LedId::Cam2 => "cam-2",
            LedId::Cam3 => "cam-3",
            LedId::AudioOnly => "audio-only",
        }
    }

    /// Inverse of [`LedId::as_str`]. `None` for anything else.
    pub fn from_str(s: &str) -> Option<LedId> {
        LedId::ALL.iter().copied().find(|led| led.as_str() == s)
    }
}

impl Serialize for LedId {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for LedId {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        LedId::from_str(&s).ok_or_else(|| de::Error::custom(format!("unknown led id: {s}")))
    }
}

/// A change to make to the LED state, sent to whichever control surface is
/// currently running (see `crate::vendor::SpeedEditor::run`, which drains
/// these on the same `HidDevice` handle it reads input reports from).
#[derive(Debug, Clone)]
pub enum LedCommand {
    Set(LedId, bool),
    SetMany(Vec<LedId>, bool),
    /// Sets an arbitrary output-report bit by index (0-31), bypassing
    /// `LedId` entirely. Only for interactively discovering unmapped LED
    /// bits (e.g. SHTL/JOG/SCRL, not currently in `LedId`) from the
    /// DevPanel against real hardware -- never used by normal app code.
    SetBit(u32, bool),
    ClearAll,
}

/// Sends LED commands to whichever control surface is currently running.
///
/// `hidapi::HidApi` is a process-wide singleton (only one instance can be
/// open at a time -- see `hidapi::HidApiLock`), and the read loop already
/// holds one for the lifetime of the connection. So this can't open its
/// own independent handle to write LEDs (that always fails with
/// `HidError::InitializationError` while the read loop's handle is open);
/// instead it's a message queue the surface's `run()` loop drains on its
/// own handle, between reads. Not attached to anything until the real
/// surface calls [`LedController::attach`] (never, in mock mode) -- until
/// then, every call fails with [`DeviceError::NotConnected`] rather than
/// silently doing nothing or touching real hardware.
pub struct LedController {
    tx: Mutex<Option<Sender<LedCommand>>>,
}

impl LedController {
    pub fn new() -> Self {
        Self {
            tx: Mutex::new(None),
        }
    }

    pub fn attach(&self, tx: Sender<LedCommand>) {
        *self.tx.lock().unwrap() = Some(tx);
    }

    pub fn set(&self, led: LedId, on: bool) -> Result<(), DeviceError> {
        self.send(LedCommand::Set(led, on))
    }

    pub fn set_many(&self, leds: &[LedId], on: bool) -> Result<(), DeviceError> {
        self.send(LedCommand::SetMany(leds.to_vec(), on))
    }

    pub fn clear_all(&self) -> Result<(), DeviceError> {
        self.send(LedCommand::ClearAll)
    }

    /// See [`LedCommand::SetBit`].
    pub fn set_bit(&self, bit: u32, on: bool) -> Result<(), DeviceError> {
        self.send(LedCommand::SetBit(bit, on))
    }

    fn send(&self, cmd: LedCommand) -> Result<(), DeviceError> {
        let guard = self.tx.lock().unwrap();
        match &*guard {
            Some(tx) => tx
                .send(cmd)
                .map_err(|_| DeviceError::Hid("LED command channel closed".into())),
            None => Err(DeviceError::NotConnected),
        }
    }
}

impl Default for LedController {
    fn default() -> Self {
        Self::new()
    }
}
