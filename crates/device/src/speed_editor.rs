use crate::control::ControlId;
use crate::event::ControlEvent;
use crate::surface::{ControlSurface, DeviceError};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

/// `ControlSurface` implementation backed by the real Blackmagic Speed
/// Editor, using the MIT-licensed `bmd-speededitor` crate for HID
/// transport, device authentication and raw event decoding.
///
/// See `claude/docs/decisions/0001-speed-editor-driver.md` for why this
/// dependency was chosen over reimplementing the HID protocol.
pub struct SpeedEditorSurface {
    name: String,
}

impl SpeedEditorSurface {
    pub fn new() -> Self {
        Self {
            name: "Speed Editor".to_string(),
        }
    }
}

impl Default for SpeedEditorSurface {
    fn default() -> Self {
        Self::new()
    }
}

/// `bmd_speededitor`'s jog callback reports a `mode` byte alongside the
/// delta. Modes 0/2 are relative (jog/scroll wheel), modes 1/3 are
/// absolute-ish (shuttle). See `SpeedEditorJogMode` in
/// https://github.com/smunaut/blackmagic-misc (Apache-2.0) for the
/// original protocol notes this crate is based on.
fn is_absolute_jog_mode(mode: u8) -> bool {
    mode == 1 || mode == 3
}

impl ControlSurface for SpeedEditorSurface {
    fn name(&self) -> &str {
        &self.name
    }

    fn run(&mut self, tx: Sender<ControlEvent>) -> Result<(), DeviceError> {
        let mut device =
            bmd_speededitor::new().map_err(|e| DeviceError::Hid(format!("{e:?}")))?;

        let tx = Arc::new(Mutex::new(tx));

        let send = |tx: &Arc<Mutex<Sender<ControlEvent>>>, event: ControlEvent| {
            let _ = tx.lock().map(|guard| guard.send(event));
        };

        {
            let tx = tx.clone();
            device.on_connected(move || {
                send(&tx, ControlEvent::Connected);
                Ok(())
            });
        }
        {
            let tx = tx.clone();
            device.on_disconnected(move || {
                send(&tx, ControlEvent::Disconnected);
                Ok(())
            });
        }
        {
            let tx = tx.clone();
            device.on_key(move |key, down| {
                if let Some(control) = ControlId::from_bmd_key(key) {
                    let event = if down {
                        ControlEvent::Pressed { control }
                    } else {
                        ControlEvent::Released { control }
                    };
                    send(&tx, event);
                }
                Ok(())
            });
        }
        {
            let tx = tx.clone();
            device.on_jog(move |mode, value| {
                let event = if is_absolute_jog_mode(mode) {
                    ControlEvent::Shuttle { value }
                } else {
                    ControlEvent::Jog { delta: value }
                };
                send(&tx, event);
                Ok(())
            });
        }

        device
            .run()
            .map_err(|e| DeviceError::Hid(format!("{e:?}")))
    }
}
