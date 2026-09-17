use crate::settings::AppSettings;
use crate::state::AppState;
use sped_device::{mock_surface, ControlEvent, ControlSurface, SpeedEditorSurface};
use std::sync::mpsc;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

/// Returns `false` if the event should be dropped entirely (within the
/// configured deadzone) -- the caller must not forward or process it.
fn apply_jog_settings(event: &mut ControlEvent, settings: &AppSettings) -> bool {
    let sign = if settings.jog.invert { -1.0 } else { 1.0 };
    match event {
        ControlEvent::Jog { delta } => {
            if delta.abs() <= settings.jog.deadzone {
                return false;
            }
            *delta = (*delta as f32 * settings.jog.sensitivity * sign).round() as i32;
        }
        ControlEvent::Shuttle { value } => {
            if value.abs() <= settings.jog.deadzone {
                return false;
            }
            *value = (*value as f32 * settings.jog.sensitivity * sign).round() as i32;
        }
        _ => {}
    }
    true
}

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

    if let Some(led_tx) = surface.led_sender() {
        if let Some(state) = app.try_state::<AppState>() {
            state.leds.attach(led_tx);
        }
    }

    thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<ControlEvent>();
        let processor_app = app.clone();

        let processor = thread::spawn(move || {
            for mut event in rx {
                let mut keep = true;

                if let Some(state) = processor_app.try_state::<AppState>() {
                    match &event {
                        ControlEvent::Connected => *state.connected.lock().unwrap() = true,
                        ControlEvent::Disconnected => *state.connected.lock().unwrap() = false,
                        _ => {}
                    }

                    // Jog/shuttle sensitivity/deadzone are user preferences
                    // with no hardware-level equivalent, so they're applied
                    // here, once, rather than duplicated in every consumer
                    // (frontend rotation, and eventually wheel-driven
                    // actions).
                    keep = apply_jog_settings(&mut event, &state.settings.get());

                    if keep {
                        let actions = state.engine.lock().unwrap().handle_event(&event);
                        if !actions.is_empty() {
                            if let Err(err) = state.dispatcher.execute_all(&actions) {
                                tracing::warn!(?err, ?event, "action execution failed");
                            }
                        }
                    }
                }

                if keep {
                    if let Err(err) = processor_app.emit("device-event", &event) {
                        tracing::warn!(?err, "failed to emit device-event");
                    }
                }
            }
        });

        if let Err(err) = surface.run(tx) {
            tracing::error!(?err, "device surface stopped");
        }
        let _ = processor.join();
    });
}
