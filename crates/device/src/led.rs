use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};

/// Physical controls that have a controllable LED. Not every key does --
/// per Blackmagic's own protocol notes (see
/// `claude/docs/decisions/0001-speed-editor-driver.md`), the transport,
/// trim and SOURCE/TIMELINE/SHTL/JOG/SCRL keys have no LED on real
/// hardware, only these do. Bit positions match the output report format
/// exactly (`SpeedEditorLed` in `smunaut/blackmagic-misc`, Apache-2.0) so
/// `speed_editor.rs` can convert with a plain `1 << bit()` -- no
/// dependency on `bmd-speededitor`'s own (private) `KeyLed` bit order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
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
}

/// Output-report LED writer, deliberately independent from
/// [`crate::SpeedEditorSurface`]/`bmd-speededitor`'s input-report read
/// loop rather than routed through it.
///
/// `bmd-speededitor::SpeedEditor::run()` only exposes a single blocking
/// call that owns the device handle for the lifetime of the read loop --
/// there is no way to interleave a write from another thread through its
/// public API without forking its (non-`pub`) connect/auth logic, which
/// would defeat the point of depending on it (see decision 0001). HID
/// output reports don't need the same handle that's reading input
/// reports, though: this opens its own short-lived `hidapi` handle to the
/// same VID/PID for each write. Whether the OS/firmware actually allows a
/// second concurrent handle, and whether the authentication the read-loop
/// handle performs is a per-handle or device-wide unlock, is **untested
/// against real hardware** -- this fails gracefully (returns
/// [`DeviceError`], never panics) if either assumption doesn't hold, per
/// this crate's error-handling rules.
pub struct LedController {
    mask: AtomicU32,
}

impl LedController {
    const VID: u16 = 7899;
    const PID: u16 = 55822;

    pub fn new() -> Self {
        Self {
            mask: AtomicU32::new(0),
        }
    }

    pub fn set(&self, led: LedId, on: bool) -> Result<(), super::DeviceError> {
        let bit = 1u32 << led.bit();
        let mask = if on {
            self.mask.fetch_or(bit, Ordering::SeqCst) | bit
        } else {
            self.mask.fetch_and(!bit, Ordering::SeqCst) & !bit
        };
        self.write(mask)
    }

    pub fn set_many(&self, leds: &[LedId], on: bool) -> Result<(), super::DeviceError> {
        let mut bits = 0u32;
        for led in leds {
            bits |= 1 << led.bit();
        }
        let mask = if on {
            self.mask.fetch_or(bits, Ordering::SeqCst) | bits
        } else {
            self.mask.fetch_and(!bits, Ordering::SeqCst) & !bits
        };
        self.write(mask)
    }

    pub fn clear_all(&self) -> Result<(), super::DeviceError> {
        self.mask.store(0, Ordering::SeqCst);
        self.write(0)
    }

    fn write(&self, mask: u32) -> Result<(), super::DeviceError> {
        let api = hidapi::HidApi::new().map_err(|e| super::DeviceError::Hid(format!("{e:?}")))?;
        let device = api
            .open(Self::VID, Self::PID)
            .map_err(|e| super::DeviceError::Hid(format!("{e:?}")))?;

        let bytes = mask.to_le_bytes();
        let report = [0x02, bytes[0], bytes[1], bytes[2], bytes[3], 0x00];
        device
            .write(&report)
            .map_err(|e| super::DeviceError::Hid(format!("{e:?}")))?;
        Ok(())
    }
}

impl Default for LedController {
    fn default() -> Self {
        Self::new()
    }
}
