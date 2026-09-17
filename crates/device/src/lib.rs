//! Device abstraction layer for the Speed Editor control surface.
//!
//! This crate is deliberately the only place that knows about HID/USB
//! details (through the `bmd-speededitor` dependency). Everything above it
//! -- the mapping engine, integrations and the Tauri command layer --
//! depends only on [`ControlSurface`], [`ControlId`] and [`ControlEvent`].

mod control;
mod event;
mod led;
mod mock;
mod speed_editor;
mod surface;
mod vendor;

pub use control::ControlId;
pub use event::ControlEvent;
pub use led::{LedCommand, LedController, LedId};
pub use mock::{mock_surface, MockCommand, MockHandle, MockSurface};
pub use speed_editor::SpeedEditorSurface;
pub use surface::{ControlSurface, DeviceError};
