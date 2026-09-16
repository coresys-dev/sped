//! Mapping engine: turns normalized device events into actions according
//! to the active profile, without knowing how any action is actually
//! executed.

mod action;
mod dispatch;
mod engine;
mod executor;
mod mapping;
mod modifier;
mod profile;
mod trigger;

pub use action::{Action, KeyboardAction, ObsAction};
pub use dispatch::Dispatcher;
pub use engine::MappingEngine;
pub use executor::{ActionError, ActionExecutor};
pub use mapping::Mapping;
pub use modifier::Modifier;
pub use profile::{Profile, ProfileError, PROFILE_FORMAT_VERSION};
pub use trigger::Trigger;
