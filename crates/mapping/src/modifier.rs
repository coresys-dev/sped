use serde::{Deserialize, Serialize};

/// A layer selector. The MVP only ever operates in `Modifier::None`; the
/// field exists throughout the data model (mappings, engine state) so
/// layers/modifiers can be turned on later without a profile migration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Modifier {
    #[default]
    None,
    Shift,
    Alt,
    Ctrl,
}
