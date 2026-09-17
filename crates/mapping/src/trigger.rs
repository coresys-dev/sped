use serde::{Deserialize, Serialize};

/// How a mapping is armed. `Press`, `Release` and the three `Jog*`
/// variants are wired to the engine's `handle_event`; `Hold`,
/// `DoublePress` and `LongPress` exist so the profile format and UI don't
/// need to change again when they are implemented.
///
/// The `Jog*` variants only apply to mappings stored under
/// `ControlId::JogWheel` (a synthetic id -- never a real key press, see
/// its doc comment): `JogClockwise`/`JogCounterClockwise` fire once every
/// time the wheel's accumulated rotation crosses `Mapping::threshold` in
/// that direction (reset on crossing, carrying the remainder);
/// `JogContinuous` fires on every wheel event, scaled live by
/// `Mapping::amount_per_tick` (see `MappingEngine::resolve_jog`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Trigger {
    Press,
    Release,
    Hold,
    DoublePress,
    LongPress,
    JogClockwise,
    JogCounterClockwise,
    JogContinuous,
}

impl Default for Trigger {
    fn default() -> Self {
        Trigger::Press
    }
}
