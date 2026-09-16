use obws::Client;
use serde::Serialize;
use sped_mapping::{Action, ActionError, ActionExecutor, ObsAction};
use std::error::Error as StdError;
use std::fmt::Write as _;
use std::sync::{Arc, Mutex};
use tokio::runtime::Runtime;

/// `obws`'s top-level `Error` wraps the real cause (e.g. auth rejected,
/// connection refused) in a `source()` chain that `.to_string()` alone
/// never surfaces -- every OBS error would otherwise just read "failed to
/// execute the handshake with obs-websocket" with no indication of *why*.
fn describe_error(err: &(dyn StdError + 'static)) -> String {
    let mut message = err.to_string();
    let mut source = err.source();
    while let Some(cause) = source {
        let _ = write!(message, ": {cause}");
        source = cause.source();
    }
    message
}

/// Connection state surfaced to the UI. OBS being unreachable is a normal,
/// expected state -- never a panic.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ObsStatus {
    #[default]
    Disconnected,
    Connecting,
    Connected {
        scenes: Vec<String>,
    },
    Error {
        message: String,
    },
}

struct ObsState {
    client: Option<Arc<Client>>,
    status: ObsStatus,
}

/// OBS WebSocket integration (first-class, not a keyboard-shortcut
/// workaround). Owns a dedicated single-threaded Tokio runtime so it can
/// be driven from the synchronous mapping engine / Tauri command layer.
/// Scene names are always fetched live from OBS, never hard-coded.
pub struct ObsIntegration {
    state: Arc<Mutex<ObsState>>,
    runtime: Runtime,
}

impl ObsIntegration {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(ObsState {
                client: None,
                status: ObsStatus::Disconnected,
            })),
            runtime: Runtime::new().expect("failed to start OBS integration runtime"),
        }
    }

    pub fn status(&self) -> ObsStatus {
        self.state.lock().unwrap().status.clone()
    }

    /// Connects (or reconnects) to OBS and retrieves the current scene
    /// list. Runs in the background; poll [`ObsIntegration::status`] for
    /// the outcome.
    pub fn connect(&self, host: String, port: u16, password: Option<String>) {
        self.state.lock().unwrap().status = ObsStatus::Connecting;
        let state = self.state.clone();

        self.runtime.spawn(async move {
            let outcome = match Client::connect(host, port, password).await {
                Ok(client) => {
                    let scenes = client
                        .scenes()
                        .list()
                        .await
                        .map(|scenes| {
                            scenes
                                .scenes
                                .into_iter()
                                .map(|scene| scene.id.name)
                                .collect()
                        })
                        .unwrap_or_default();
                    Ok((client, scenes))
                }
                Err(e) => Err(describe_error(&e)),
            };

            // The lock is only ever taken synchronously (never across an
            // `.await`) so this future stays `Send`.
            let mut guard = state.lock().unwrap();
            match outcome {
                Ok((client, scenes)) => {
                    guard.status = ObsStatus::Connected { scenes };
                    guard.client = Some(Arc::new(client));
                }
                Err(message) => {
                    guard.status = ObsStatus::Error { message };
                    guard.client = None;
                }
            }
        });
    }

    pub fn disconnect(&self) {
        let mut guard = self.state.lock().unwrap();
        guard.client = None;
        guard.status = ObsStatus::Disconnected;
    }

    fn run_action(&self, action: ObsAction) -> Result<(), ActionError> {
        let state = self.state.clone();
        self.runtime.block_on(async move {
            let client: Arc<Client> = {
                let guard = state.lock().unwrap();
                guard
                    .client
                    .clone()
                    .ok_or_else(|| ActionError::Failed("OBS is not connected".into()))?
            };

            let result = match action {
                ObsAction::SwitchScene { scene } => {
                    client.scenes().set_current_program_scene(scene.as_str()).await
                }
                ObsAction::StartRecording => client.recording().start().await,
                ObsAction::StopRecording => client.recording().stop().await.map(|_| ()),
                ObsAction::PauseRecording => client.recording().pause().await,
                ObsAction::ResumeRecording => client.recording().resume().await,
                ObsAction::StartStreaming => client.streaming().start().await,
                ObsAction::StopStreaming => client.streaming().stop().await,
            };

            result.map_err(|e| ActionError::Failed(describe_error(&e)))
        })
    }
}

impl Default for ObsIntegration {
    fn default() -> Self {
        Self::new()
    }
}

impl ActionExecutor for ObsIntegration {
    fn execute(&self, action: &Action) -> Result<(), ActionError> {
        let Action::Obs(obs_action) = action else {
            return Err(ActionError::Unsupported);
        };
        self.run_action(obs_action.clone())
    }
}
