use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;

/// Identifies a single physical control on the Speed Editor.
///
/// Variants mirror the physical silkscreen labels exactly (see
/// `claude/docs/speed-editor-layout.html`) so the mapping engine, the
/// frontend visualizer and the device layer always agree on names.
///
/// `Serialize`/`Deserialize` are hand-written against [`ControlId::as_str`]
/// (below) rather than derived with `#[serde(rename_all = "kebab-case")]`:
/// serde's automatic case conversion doesn't insert a hyphen before a
/// digit (`Cam1` -> `"cam1"`, not `"cam-1"`), and a few multi-word names
/// don't decompose the way the derive would guess (`RiplOwr` ->
/// `"ripl-owr"`, not `"ripple-owr"`; `SmthCut` -> `"smth-cut"`, not
/// `"smooth-cut"`; `PlaceOnTop` -> `"place-on-top"`, not `"place-top"`;
/// `Appnd` -> `"appnd"`, not `"append"`; `Split` -> `"split"`, not
/// `"split-move"`; `RiplDel` -> `"ripl-del"`, not `"ripple-delete"`;
/// `SrcOwr` -> `"src-owr"`, not `"source-owr"`). That silently desynced
/// the ids serialized into `device-event` payloads (using the derive)
/// from the ones the frontend's `data-control` grid and `as_str()`'s own
/// callers use, so those controls' physical key presses never matched a
/// grid cell and never visibly highlighted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ControlId {
    SmartInsert,
    Appnd,
    RiplOwr,
    CloseUp,
    PlaceOnTop,
    SrcOwr,

    In,
    Out,
    TrimIn,
    TrimOut,
    Roll,
    SlipSrc,
    SlipDest,
    TransDur,
    Cut,
    Dis,
    SmthCut,

    Esc,
    SyncBin,
    AudioLevel,
    FullView,
    TransTitle,
    Split,
    Snap,
    RiplDel,

    Cam1,
    Cam2,
    Cam3,
    Cam4,
    Cam5,
    Cam6,
    Cam7,
    Cam8,
    Cam9,
    LiveOwr,
    VideoOnly,
    AudioOnly,
    StopPlay,

    Source,
    Timeline,

    /// Wheel-mode selector buttons. Pressing one of these changes how
    /// `ControlEvent::Jog` / `ControlEvent::Shuttle` deltas should be
    /// interpreted by the mapping engine. Each lights up on real hardware
    /// to show which mode is active, but that indicator is driven
    /// autonomously by the device's own firmware, not by the host -- see
    /// `sped_device::LedId`'s doc comment. Not in `LedId` for that reason.
    Shuttle,
    Jog,
    Scroll,

    /// Synthetic id for the physical rotary wheel's *motion* while in jog
    /// mode (`ControlEvent::Jog { delta }`), as opposed to [`Self::Jog`]
    /// above, which is the button *press* that selects jog mode. Never
    /// produced by [`Self::from_bmd_key`] (no real key reports it) --
    /// exists only as a `Profile::mappings` storage key and frontend
    /// drop-target id, resolved by `sped_mapping::MappingEngine`'s
    /// `Trigger::Jog*` handling, not by a `Pressed`/`Released` event.
    JogWheel,
}

impl ControlId {
    /// All controls, in the same order they are declared. Used by the
    /// `ControlSurface::controls()` implementations and by the frontend
    /// bootstrap payload.
    pub const ALL: &'static [ControlId] = &[
        ControlId::SmartInsert,
        ControlId::Appnd,
        ControlId::RiplOwr,
        ControlId::CloseUp,
        ControlId::PlaceOnTop,
        ControlId::SrcOwr,
        ControlId::In,
        ControlId::Out,
        ControlId::TrimIn,
        ControlId::TrimOut,
        ControlId::Roll,
        ControlId::SlipSrc,
        ControlId::SlipDest,
        ControlId::TransDur,
        ControlId::Cut,
        ControlId::Dis,
        ControlId::SmthCut,
        ControlId::Esc,
        ControlId::SyncBin,
        ControlId::AudioLevel,
        ControlId::FullView,
        ControlId::TransTitle,
        ControlId::Split,
        ControlId::Snap,
        ControlId::RiplDel,
        ControlId::Cam1,
        ControlId::Cam2,
        ControlId::Cam3,
        ControlId::Cam4,
        ControlId::Cam5,
        ControlId::Cam6,
        ControlId::Cam7,
        ControlId::Cam8,
        ControlId::Cam9,
        ControlId::LiveOwr,
        ControlId::VideoOnly,
        ControlId::AudioOnly,
        ControlId::StopPlay,
        ControlId::Source,
        ControlId::Timeline,
        ControlId::Shuttle,
        ControlId::Jog,
        ControlId::Scroll,
        ControlId::JogWheel,
    ];

    /// Stable identifier used in JSON payloads and profile files, matching
    /// the `data-control` attributes in the HTML layout reference.
    pub fn as_str(&self) -> &'static str {
        match self {
            ControlId::SmartInsert => "smart-insert",
            ControlId::Appnd => "append",
            ControlId::RiplOwr => "ripple-owr",
            ControlId::CloseUp => "close-up",
            ControlId::PlaceOnTop => "place-top",
            ControlId::SrcOwr => "source-owr",
            ControlId::In => "in",
            ControlId::Out => "out",
            ControlId::TrimIn => "trim-in",
            ControlId::TrimOut => "trim-out",
            ControlId::Roll => "roll",
            ControlId::SlipSrc => "slip-src",
            ControlId::SlipDest => "slip-dest",
            ControlId::TransDur => "trans-dur",
            ControlId::Cut => "cut",
            ControlId::Dis => "dis",
            ControlId::SmthCut => "smth-cut",
            ControlId::Esc => "esc",
            ControlId::SyncBin => "sync-bin",
            ControlId::AudioLevel => "audio-level",
            ControlId::FullView => "full-view",
            ControlId::TransTitle => "trans-title",
            ControlId::Split => "split-move",
            ControlId::Snap => "snap",
            ControlId::RiplDel => "ripple-delete",
            ControlId::Cam1 => "cam-1",
            ControlId::Cam2 => "cam-2",
            ControlId::Cam3 => "cam-3",
            ControlId::Cam4 => "cam-4",
            ControlId::Cam5 => "cam-5",
            ControlId::Cam6 => "cam-6",
            ControlId::Cam7 => "cam-7",
            ControlId::Cam8 => "cam-8",
            ControlId::Cam9 => "cam-9",
            ControlId::LiveOwr => "live-owr",
            ControlId::VideoOnly => "video-only",
            ControlId::AudioOnly => "audio-only",
            ControlId::StopPlay => "stop-play",
            ControlId::Source => "source",
            ControlId::Timeline => "timeline",
            ControlId::Shuttle => "shuttle",
            ControlId::Jog => "jog",
            ControlId::Scroll => "scroll",
            ControlId::JogWheel => "jog-wheel",
        }
    }

    /// Inverse of [`ControlId::as_str`]. `None` for anything else.
    pub fn from_str(s: &str) -> Option<ControlId> {
        ControlId::ALL.iter().copied().find(|c| c.as_str() == s)
    }

    /// Maps a raw key code from the vendored `bmd-speededitor` fork
    /// (`crate::vendor`) to our normalized `ControlId`. Returns `None` for
    /// `Key::None`.
    pub fn from_bmd_key(key: crate::vendor::key::Key) -> Option<ControlId> {
        use crate::vendor::key::Key;
        Some(match key {
            Key::None => return None,
            Key::SmartInsrt => ControlId::SmartInsert,
            Key::Appnd => ControlId::Appnd,
            Key::RiplOwr => ControlId::RiplOwr,
            Key::CloseUp => ControlId::CloseUp,
            Key::PlaceOnTop => ControlId::PlaceOnTop,
            Key::SrcOwr => ControlId::SrcOwr,
            Key::In => ControlId::In,
            Key::Out => ControlId::Out,
            Key::TrimIn => ControlId::TrimIn,
            Key::TrimOut => ControlId::TrimOut,
            Key::Roll => ControlId::Roll,
            Key::SlipSrc => ControlId::SlipSrc,
            Key::SlipDest => ControlId::SlipDest,
            Key::TransDur => ControlId::TransDur,
            Key::Cut => ControlId::Cut,
            Key::Dis => ControlId::Dis,
            Key::SmthCut => ControlId::SmthCut,
            Key::Esc => ControlId::Esc,
            Key::SyncBin => ControlId::SyncBin,
            Key::AudioLevel => ControlId::AudioLevel,
            Key::FullView => ControlId::FullView,
            Key::Trans => ControlId::TransTitle,
            Key::Split => ControlId::Split,
            Key::Snap => ControlId::Snap,
            Key::RiplDel => ControlId::RiplDel,
            Key::Cam1 => ControlId::Cam1,
            Key::Cam2 => ControlId::Cam2,
            Key::Cam3 => ControlId::Cam3,
            Key::Cam4 => ControlId::Cam4,
            Key::Cam5 => ControlId::Cam5,
            Key::Cam6 => ControlId::Cam6,
            Key::Cam7 => ControlId::Cam7,
            Key::Cam8 => ControlId::Cam8,
            Key::Cam9 => ControlId::Cam9,
            Key::LiveOwr => ControlId::LiveOwr,
            Key::VideoOnly => ControlId::VideoOnly,
            Key::AudioOnly => ControlId::AudioOnly,
            Key::StopPlay => ControlId::StopPlay,
            Key::Source => ControlId::Source,
            Key::Timeline => ControlId::Timeline,
            Key::Shtl => ControlId::Shuttle,
            Key::Jog => ControlId::Jog,
            Key::Scrl => ControlId::Scroll,
        })
    }
}

impl fmt::Display for ControlId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Serialize for ControlId {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for ControlId {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        ControlId::from_str(&s).ok_or_else(|| de::Error::custom(format!("unknown control id: {s}")))
    }
}
