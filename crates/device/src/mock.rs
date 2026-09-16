use crate::control::ControlId;
use crate::event::ControlEvent;
use crate::surface::{ControlSurface, DeviceError};
use serde::{Deserialize, Serialize};
use std::sync::mpsc::{self, Receiver, Sender};

/// Commands a developer-mode UI (or a test) can inject into a
/// `MockSurface` to simulate physical interaction without hardware.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", content = "value", rename_all = "snake_case")]
pub enum MockCommand {
    Press(ControlId),
    Release(ControlId),
    /// Convenience: press immediately followed by release.
    Tap(ControlId),
    Jog(i32),
    Shuttle(i32),
    Disconnect,
    Reconnect,
}

/// Handle used to drive a running `MockSurface` from outside its event
/// thread (e.g. a Tauri command backing a "mock controls" dev panel).
#[derive(Clone)]
pub struct MockHandle {
    tx: Sender<MockCommand>,
}

impl MockHandle {
    pub fn send(&self, command: MockCommand) {
        let _ = self.tx.send(command);
    }
}

/// `ControlSurface` implementation with no hardware dependency, used for
/// frontend/mapping-engine development and in automated tests.
pub struct MockSurface {
    name: String,
    rx: Receiver<MockCommand>,
}

/// Creates a connected pair: the `MockSurface` to hand to the device
/// manager, and the `MockHandle` used to simulate input.
pub fn mock_surface() -> (MockSurface, MockHandle) {
    let (tx, rx) = mpsc::channel();
    (
        MockSurface {
            name: "Mock Speed Editor".to_string(),
            rx,
        },
        MockHandle { tx },
    )
}

impl ControlSurface for MockSurface {
    fn name(&self) -> &str {
        &self.name
    }

    fn run(&mut self, tx: Sender<ControlEvent>) -> Result<(), DeviceError> {
        tx.send(ControlEvent::Connected)
            .map_err(|e| DeviceError::ChannelClosed(e.to_string()))?;

        while let Ok(command) = self.rx.recv() {
            let result = match command {
                MockCommand::Press(control) => tx.send(ControlEvent::Pressed { control }),
                MockCommand::Release(control) => tx.send(ControlEvent::Released { control }),
                MockCommand::Tap(control) => tx
                    .send(ControlEvent::Pressed { control })
                    .and_then(|_| tx.send(ControlEvent::Released { control })),
                MockCommand::Jog(delta) => tx.send(ControlEvent::Jog { delta }),
                MockCommand::Shuttle(value) => tx.send(ControlEvent::Shuttle { value }),
                MockCommand::Disconnect => tx.send(ControlEvent::Disconnected),
                MockCommand::Reconnect => tx.send(ControlEvent::Connected),
            };
            if result.is_err() {
                break;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn tap_emits_press_then_release() {
        let (mut surface, handle) = mock_surface();
        let (tx, rx) = mpsc::channel();

        let join = thread::spawn(move || surface.run(tx));

        assert_eq!(rx.recv().unwrap(), ControlEvent::Connected);

        handle.send(MockCommand::Tap(ControlId::Cut));
        assert_eq!(
            rx.recv().unwrap(),
            ControlEvent::Pressed {
                control: ControlId::Cut
            }
        );
        assert_eq!(
            rx.recv().unwrap(),
            ControlEvent::Released {
                control: ControlId::Cut
            }
        );

        drop(handle);
        join.join().unwrap().unwrap();
    }

    #[test]
    fn jog_and_shuttle_pass_through() {
        let (mut surface, handle) = mock_surface();
        let (tx, rx) = mpsc::channel();
        let join = thread::spawn(move || surface.run(tx));

        assert_eq!(rx.recv().unwrap(), ControlEvent::Connected);
        handle.send(MockCommand::Jog(5));
        assert_eq!(rx.recv().unwrap(), ControlEvent::Jog { delta: 5 });
        handle.send(MockCommand::Shuttle(-3));
        assert_eq!(rx.recv().unwrap(), ControlEvent::Shuttle { value: -3 });

        drop(handle);
        join.join().unwrap().unwrap();
    }
}
