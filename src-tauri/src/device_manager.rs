use crate::state::AppState;
use sped_device::{mock_surface, ControlEvent, ControlSurface, SpeedEditorSurface};
use std::sync::mpsc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

/// Starts the background device thread. Reads `SPED_MOCK=1` to run the
/// [`sped_device::MockSurface`] instead of the real hardware, so the
/// frontend and mapping engine can be developed/tested without a Speed
/// Editor attached (see requirement #24).
pub fn spawn(app: AppHandle) {
    let use_mock = std::env::var("SPED_MOCK").is_ok();

    let mut surface: Box<dyn ControlSurface> = if use_mock {
        let (surface, handle) = mock_surface();
        if let Some(state) = app.try_state::<AppState>() {
            *state.mock_handle.lock().unwrap() = Some(handle);
        }
        tracing::info!("device layer running in mock mode (SPED_MOCK=1)");
        Box::new(surface)
    } else {
        Box::new(SpeedEditorSurface::new())
    };

    thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<ControlEvent>();
        let processor_app = app.clone();

        let processor = thread::spawn(move || {
            for event in rx {
                if let Some(state) = processor_app.try_state::<AppState>() {
                    match &event {
                        ControlEvent::Connected => *state.connected.lock().unwrap() = true,
                        ControlEvent::Disconnected => *state.connected.lock().unwrap() = false,
                        _ => {}
                    }

                    let actions = state.engine.lock().unwrap().handle_event(&event);
                    if !actions.is_empty() {
                        if let Err(err) = state.dispatcher.execute_all(&actions) {
                            tracing::warn!(?err, ?event, "action execution failed");
                        }
                    }
                }

                if let Err(err) = processor_app.emit("device-event", &event) {
                    tracing::warn!(?err, "failed to emit device-event");
                }
            }
        });

        if let Err(err) = surface.run(tx) {
            tracing::error!(?err, "device surface stopped");
        }
        let _ = processor.join();
    });
}
