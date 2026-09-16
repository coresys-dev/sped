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
}

impl Mapping {
    pub fn simple(actions: Vec<Action>) -> Self {
        Self {
            trigger: Trigger::Press,
            modifier: Modifier::None,
            actions,
        }
    }
}
