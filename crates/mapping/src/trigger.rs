use serde::{Deserialize, Serialize};

/// How a mapping is armed. Only `Press` and `Release` are wired to the
/// engine's `handle_event` in the MVP; the other variants exist so the
/// profile format and UI don't need to change when they are implemented.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Trigger {
    Press,
    Release,
    Hold,
    DoublePress,
    LongPress,
}

impl Default for Trigger {
    fn default() -> Self {
        Trigger::Press
    }
}
