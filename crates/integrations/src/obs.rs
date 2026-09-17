use obws::requests::inputs::{InputId, Volume};
use obws::requests::scene_items::{Id as SceneItemId, SetEnabled};
use obws::requests::scenes::SceneId;
use obws::Client;
use serde::Serialize;
use sped_mapping::{
    Action, ActionError, ActionExecutor, MuteMode, ObsAction, RecordingMode, StartStopToggle,
    StudioModeMode, VisibilityMode, VolumeMode,
};
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
        inputs: Vec<String>,
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
                    let inputs = client
                        .inputs()
                        .list(None)
                        .await
                        .map(|inputs| inputs.into_iter().map(|input| input.id.name).collect())
                        .unwrap_or_default();
                    Ok((client, scenes, inputs))
                }
                Err(e) => Err(describe_error(&e)),
            };

            // The lock is only ever taken synchronously (never across an
            // `.await`) so this future stays `Send`.
            let mut guard = state.lock().unwrap();
            match outcome {
                Ok((client, scenes, inputs)) => {
                    guard.status = ObsStatus::Connected { scenes, inputs };
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
                ObsAction::Recording { mode } => match mode {
                    RecordingMode::Start => client.recording().start().await,
                    RecordingMode::Stop => client.recording().stop().await.map(|_| ()),
                    RecordingMode::Pause => client.recording().pause().await,
                    RecordingMode::Resume => client.recording().resume().await,
                    RecordingMode::Toggle => client.recording().toggle().await.map(|_| ()),
                },
                ObsAction::Streaming { mode } => match mode {
                    StartStopToggle::Start => client.streaming().start().await,
                    StartStopToggle::Stop => client.streaming().stop().await,
                    StartStopToggle::Toggle => client.streaming().toggle().await.map(|_| ()),
                },
                ObsAction::VirtualCam { mode } => match mode {
                    StartStopToggle::Start => client.virtual_cam().start().await,
                    StartStopToggle::Stop => client.virtual_cam().stop().await,
                    StartStopToggle::Toggle => client.virtual_cam().toggle().await.map(|_| ()),
                },
                ObsAction::StudioMode { mode } => match mode {
                    StudioModeMode::Enable => client.ui().set_studio_mode_enabled(true).await,
                    StudioModeMode::Disable => client.ui().set_studio_mode_enabled(false).await,
                    StudioModeMode::Toggle => {
                        let current = client
                            .ui()
                            .studio_mode_enabled()
                            .await
                            .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                        client.ui().set_studio_mode_enabled(!current).await
                    }
                    StudioModeMode::TriggerTransition => client.transitions().trigger().await,
                },
                ObsAction::SourceMute { source, mode } => {
                    if source.is_empty() {
                        return Err(ActionError::Failed("source not set".into()));
                    }
                    let input = InputId::Name(source.as_str());
                    match mode {
                        MuteMode::Mute => client.inputs().set_muted(input, true).await,
                        MuteMode::Unmute => client.inputs().set_muted(input, false).await,
                        MuteMode::Toggle => client.inputs().toggle_mute(input).await.map(|_| ()),
                    }
                }
                ObsAction::SourceVisibility { scene, source, mode } => {
                    if scene.is_empty() || source.is_empty() {
                        return Err(ActionError::Failed("scene or source not set".into()));
                    }
                    let scene_id = SceneId::Name(scene.as_str());
                    let item_id = client
                        .scene_items()
                        .id(SceneItemId {
                            scene: scene_id,
                            source: source.as_str(),
                            search_offset: None,
                        })
                        .await
                        .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                    let enabled = match mode {
                        VisibilityMode::Show => true,
                        VisibilityMode::Hide => false,
                        VisibilityMode::Toggle => {
                            let current = client
                                .scene_items()
                                .enabled(scene_id, item_id)
                                .await
                                .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                            !current
                        }
                    };
                    client
                        .scene_items()
                        .set_enabled(SetEnabled { scene: scene_id, item_id, enabled })
                        .await
                }
                ObsAction::SourceVolume { source, mode } => {
                    if source.is_empty() {
                        return Err(ActionError::Failed("source not set".into()));
                    }
                    let input = InputId::Name(source.as_str());
                    match mode {
                        VolumeMode::Absolute { percent } => {
                            client.inputs().set_volume(input, Volume::Mul(percent / 100.0)).await
                        }
                        VolumeMode::Relative { delta_percent } => {
                            let current = client
                                .inputs()
                                .volume(input)
                                .await
                                .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                            let new_mul = (current.mul + delta_percent / 100.0).clamp(0.0, 20.0);
                            client.inputs().set_volume(input, Volume::Mul(new_mul)).await
                        }
                    }
                }
            };

            result.map_err(|e| ActionError::Failed(describe_error(&e)))
        })
    }

    /// Lists the names of every scene item (source) in `scene`, for the
    /// Properties Panel's Source Visibility picker. Fetched on demand
    /// rather than prefetched for every scene at connect time.
    pub fn scene_items(&self, scene: String) -> Result<Vec<String>, String> {
        let state = self.state.clone();
        self.runtime.block_on(async move {
            let client: Arc<Client> = {
                let guard = state.lock().unwrap();
                guard.client.clone().ok_or("OBS is not connected")?
            };
            client
                .scene_items()
                .list(SceneId::Name(scene.as_str()))
                .await
                .map(|items| items.into_iter().map(|item| item.source_name).collect())
                .map_err(|e| describe_error(&e))
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
