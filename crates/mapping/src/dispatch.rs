use crate::action::Action;
use crate::executor::{ActionError, ActionExecutor};

/// Fans an [`Action`] out to whichever registered executor claims it.
/// Executors signal "not mine" by returning `ActionError::Unsupported`.
#[derive(Default)]
pub struct Dispatcher {
    executors: Vec<Box<dyn ActionExecutor>>,
}

impl Dispatcher {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, executor: Box<dyn ActionExecutor>) {
        self.executors.push(executor);
    }

    pub fn execute(&self, action: &Action) -> Result<(), ActionError> {
        for executor in &self.executors {
            match executor.execute(action) {
                Err(ActionError::Unsupported) => continue,
                other => return other,
            }
        }
        Err(ActionError::Unsupported)
    }

    /// Executes actions in order, stopping at the first error so ordering
    /// stays deterministic and failures are easy to reason about.
    pub fn execute_all(&self, actions: &[Action]) -> Result<(), ActionError> {
        for action in actions {
            self.execute(action)?;
        }
        Ok(())
    }
}
