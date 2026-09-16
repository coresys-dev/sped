use crate::control::ControlId;
use serde::{Deserialize, Serialize};

/// Application-level, hardware-agnostic event produced by any
/// `ControlSurface` implementation (real device or mock). The mapping
/// engine and the frontend never see raw HID packets, only these.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControlEvent {
    /// The control surface finished (re)connecting.
    Connected,
    /// The control surface was unplugged or stopped responding.
    Disconnected,
    /// A control was pressed down.
    Pressed { control: ControlId },
    /// A previously pressed control was released.
    Released { control: ControlId },
    /// Relative wheel movement while in JOG/SCRL mode.
    Jog { delta: i32 },
    /// Wheel position while in SHTL (absolute) mode.
    Shuttle { value: i32 },
}
