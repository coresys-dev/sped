use crate::action::Action;
use crate::modifier::Modifier;
use crate::trigger::Trigger;
use serde::{Deserialize, Serialize};

/// One rule: "when `trigger` fires while `modifier` is active, run
/// `actions` in order". A control can have several `Mapping`s (different
/// triggers/modifiers) and several actions per mapping.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Mapping {
    #[serde(default)]
    pub trigger: Trigger,
    #[serde(default)]
    pub modifier: Modifier,
    pub actions: Vec<Action>,
    /// Only meaningful for `Trigger::JogClockwise`/`JogCounterClockwise`:
    /// accumulated wheel rotation (post sensitivity/deadzone) needed in
    /// that direction before this mapping fires once. Ignored by every
    /// other trigger.
    #[serde(default = "default_jog_threshold")]
    pub threshold: i32,
    /// Only meaningful for `Trigger::JogContinuous`: multiplies the raw
    /// per-event wheel delta into the mapped action's continuous
    /// parameter (currently only `ObsAction::SourceVolume`'s
    /// `VolumeMode::Relative.delta_percent`) each time it fires. Ignored
    /// by every other trigger.
    #[serde(default = "default_jog_amount_per_tick")]
    pub amount_per_tick: f32,
}

fn default_jog_threshold() -> i32 {
    10
}

fn default_jog_amount_per_tick() -> f32 {
    1.0
}

impl Mapping {
    pub fn simple(actions: Vec<Action>) -> Self {
        Self {
            trigger: Trigger::Press,
            modifier: Modifier::None,
            actions,
            threshold: default_jog_threshold(),
            amount_per_tick: default_jog_amount_per_tick(),
        }
    }
}
