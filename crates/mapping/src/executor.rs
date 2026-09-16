use crate::action::Action;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ActionError {
    #[error("no executor registered for this action")]
    Unsupported,
    #[error("action failed: {0}")]
    Failed(String),
}

/// Runs a single [`Action`]. Implemented per-integration in
/// `sped-integrations` (keyboard, OBS, ...) and composed by
/// [`crate::dispatch::Dispatcher`].
pub trait ActionExecutor: Send + Sync {
    fn execute(&self, action: &Action) -> Result<(), ActionError>;
}
