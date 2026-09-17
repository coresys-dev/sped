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
///
/// Each family is a single variant with a `mode` rather than one variant
/// per operation, so the sidebar can offer one draggable action per family
/// (e.g. "Recording Control") that's reconfigured afterwards instead of
/// re-dragged. `source`/`scene` fields are `""` when not yet configured;
/// execution fails cleanly rather than panicking on an empty value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum ObsAction {
    SwitchScene { scene: String },
    Recording { mode: RecordingMode },
    Streaming { mode: StartStopToggle },
    VirtualCam { mode: StartStopToggle },
    StudioMode { mode: StudioModeMode },
    SourceMute { source: String, mode: MuteMode },
    SourceVisibility { scene: String, source: String, mode: VisibilityMode },
    SourceVolume { source: String, mode: VolumeMode },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecordingMode {
    Start,
    Stop,
    Pause,
    Resume,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StartStopToggle {
    Start,
    Stop,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StudioModeMode {
    Enable,
    Disable,
    Toggle,
    TriggerTransition,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MuteMode {
    Mute,
    Unmute,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VisibilityMode {
    Show,
    Hide,
    Toggle,
}

/// Whether a `VolumeMode` value is a plain percentage (100.0 = unity gain)
/// or a dB value matching OBS's own mixer display. Both are converted to
/// `obws`'s linear `mul` at the execution boundary
/// (`sped-integrations::obs`) -- never stored as `mul` so the UI can show
/// either unit directly.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum VolumeUnit {
    #[default]
    Percent,
    Db,
}

/// `value` is a percentage or a dB delta depending on `unit`. The `percent`
/// field name is kept as a deserialize-only alias so profiles saved before
/// `unit` existed (implicitly percent) still load.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum VolumeMode {
    Absolute {
        #[serde(alias = "percent")]
        value: f32,
        #[serde(default)]
        unit: VolumeUnit,
    },
    Relative {
        #[serde(alias = "delta_percent")]
        value: f32,
        #[serde(default)]
        unit: VolumeUnit,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trips(action: &ObsAction) {
        let json = serde_json::to_string(action).unwrap();
        let restored: ObsAction = serde_json::from_str(&json).unwrap();
        assert_eq!(&restored, action);
    }

    #[test]
    fn switch_scene_round_trips() {
        round_trips(&ObsAction::SwitchScene { scene: "Main".into() });
    }

    #[test]
    fn recording_round_trips_every_mode() {
        for mode in [
            RecordingMode::Start,
            RecordingMode::Stop,
            RecordingMode::Pause,
            RecordingMode::Resume,
            RecordingMode::Toggle,
        ] {
            round_trips(&ObsAction::Recording { mode });
        }
    }

    #[test]
    fn streaming_round_trips_every_mode() {
        for mode in [StartStopToggle::Start, StartStopToggle::Stop, StartStopToggle::Toggle] {
            round_trips(&ObsAction::Streaming { mode });
        }
    }

    #[test]
    fn virtual_cam_round_trips_every_mode() {
        for mode in [StartStopToggle::Start, StartStopToggle::Stop, StartStopToggle::Toggle] {
            round_trips(&ObsAction::VirtualCam { mode });
        }
    }

    #[test]
    fn studio_mode_round_trips_every_mode() {
        for mode in [
            StudioModeMode::Enable,
            StudioModeMode::Disable,
            StudioModeMode::Toggle,
            StudioModeMode::TriggerTransition,
        ] {
            round_trips(&ObsAction::StudioMode { mode });
        }
    }

    #[test]
    fn source_mute_round_trips_every_mode() {
        for mode in [MuteMode::Mute, MuteMode::Unmute, MuteMode::Toggle] {
            round_trips(&ObsAction::SourceMute { source: "Mic".into(), mode });
        }
    }

    #[test]
    fn source_visibility_round_trips_every_mode() {
        for mode in [VisibilityMode::Show, VisibilityMode::Hide, VisibilityMode::Toggle] {
            round_trips(&ObsAction::SourceVisibility {
                scene: "Main".into(),
                source: "Webcam".into(),
                mode,
            });
        }
    }

    #[test]
    fn source_volume_round_trips_absolute_and_relative() {
        round_trips(&ObsAction::SourceVolume {
            source: "Mic".into(),
            mode: VolumeMode::Absolute { value: 75.0, unit: VolumeUnit::Percent },
        });
        round_trips(&ObsAction::SourceVolume {
            source: "Mic".into(),
            mode: VolumeMode::Relative { value: -10.0, unit: VolumeUnit::Percent },
        });
        round_trips(&ObsAction::SourceVolume {
            source: "Mic".into(),
            mode: VolumeMode::Absolute { value: -6.0, unit: VolumeUnit::Db },
        });
        round_trips(&ObsAction::SourceVolume {
            source: "Mic".into(),
            mode: VolumeMode::Relative { value: 3.0, unit: VolumeUnit::Db },
        });
    }

    #[test]
    fn source_volume_deserializes_pre_unit_profiles_as_percent() {
        let json = r#"{"op":"source_volume","source":"Mic","mode":{"kind":"absolute","percent":75.0}}"#;
        let action: ObsAction = serde_json::from_str(json).unwrap();
        assert_eq!(
            action,
            ObsAction::SourceVolume {
                source: "Mic".into(),
                mode: VolumeMode::Absolute { value: 75.0, unit: VolumeUnit::Percent },
            }
        );
    }

    #[test]
    fn op_tag_is_snake_case() {
        let json = serde_json::to_string(&ObsAction::VirtualCam { mode: StartStopToggle::Toggle })
            .unwrap();
        assert!(json.contains(r#""op":"virtual_cam""#));
        assert!(json.contains(r#""mode":"toggle""#));

        let json = serde_json::to_string(&ObsAction::StudioMode {
            mode: StudioModeMode::TriggerTransition,
        })
        .unwrap();
        assert!(json.contains(r#""mode":"trigger_transition""#));
    }
}
