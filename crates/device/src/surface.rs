use crate::control::ControlId;
use crate::event::ControlEvent;
use crate::led::LedCommand;
use std::sync::mpsc::Sender;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DeviceError {
    #[error("device is not connected")]
    NotConnected,
    #[error("failed to deliver event: {0}")]
    ChannelClosed(String),
    #[error("HID error: {0}")]
    Hid(String),
}

/// Abstraction over any physical or virtual control surface.
///
/// The rest of the application (mapping engine, Tauri commands, frontend)
/// only depends on this trait, never on HID/USB details directly. This is
/// what lets `SpeedEditorSurface` and `MockSurface` be interchangeable.
pub trait ControlSurface: Send {
    /// Human-readable name, shown in the connection UI.
    fn name(&self) -> &str;

    /// All controls this surface exposes.
    fn controls(&self) -> &'static [ControlId] {
        ControlId::ALL
    }

    /// Blocking event loop. Implementations should keep retrying to
    /// (re)connect internally and emit `ControlEvent::Connected` /
    /// `ControlEvent::Disconnected` as connection state changes, returning
    /// only on unrecoverable error or when asked to stop.
    fn run(&mut self, tx: Sender<ControlEvent>) -> Result<(), DeviceError>;

    /// A sender `run()` will drain LED commands from once it starts, if
    /// this surface has LEDs at all. `None` (the default) for surfaces
    /// with no LED hardware, e.g. `MockSurface` -- `LedController::send`
    /// then fails with `DeviceError::NotConnected` instead of pretending
    /// to succeed.
    fn led_sender(&mut self) -> Option<Sender<LedCommand>> {
        None
    }
}
