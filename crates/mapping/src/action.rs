use serde::{Deserialize, Serialize};

/// Something that can be executed when a mapping fires.
///
/// New integrations add a variant here plus a matching executor in
/// `sped-integrations`; the engine and profile format never need to
/// change. See `claude/docs/decisions/0002-action-model.md`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Action {
    Keyboard(KeyboardAction),
    Obs(ObsAction),
}

/// A keyboard shortcut stored as a normalized set of key names rather than
/// a display string (e.g. `["CTRL", "B"]`, never `"Ctrl+B"`), so it can be
/// replayed unambiguously regardless of keyboard layout or locale.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyboardAction {
    pub keys: Vec<String>,
}

/// OBS WebSocket actions. Scene/source names are never hard-coded by the
/// application -- they are picked by the user from data retrieved live
/// from OBS (see `sped-integrations::obs`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum ObsAction {
    SwitchScene { scene: String },
    StartRecording,
    StopRecording,
    PauseRecording,
    ResumeRecording,
    StartStreaming,
    StopStreaming,
}
