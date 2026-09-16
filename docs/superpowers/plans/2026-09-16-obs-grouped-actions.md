# Grouped, Configurable OBS Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, one-operation-per-item OBS actions (`start_recording`, `stop_recording`, …) with one draggable action per family (Recording, Streaming, Virtual Camera, Studio Mode, Source Mute, Source Visibility, Source Volume), each carrying a `mode` that defaults sensibly on drop and is fully editable afterwards in the Properties Panel.

**Architecture:** `ObsAction` (Rust, `crates/mapping/src/action.rs`) gets one variant per family instead of one per operation, mirrored 1:1 in `src/types.ts`. Execution (`crates/integrations/src/obs.rs`) maps each variant/mode to the matching `obws` 0.15 call, resolving scene-item ids and source names at fire-time rather than caching them. The frontend sidebar drops a family with a default mode; the Properties Panel gains inline `<select>`/`<input>` editors wired through a new `onUpdateAction` callback that replaces an action in place.

**Tech Stack:** Rust (`sped-mapping`, `sped-integrations`, `obws` 0.15, `tauri`), TypeScript/React (Vite, Tailwind).

**Spec:** `docs/superpowers/specs/2026-09-16-obs-grouped-actions-design.md`

## Global Constraints

- Breaking change accepted: old saved profiles referencing `start_recording`/`stop_recording`/etc. will fail to deserialize that one action. No migration code is written (app is pre-1.0/MVP).
- All new enum variants use `#[serde(rename_all = "snake_case")]` / matching lowercase-snake TS string literals, consistent with the existing `Action`/`ObsAction` tagging convention (`tag = "kind"` / `tag = "op"`).
- `VolumeMode`'s relative field is named `delta_percent` (snake_case) in both Rust and TS, for 1:1 JSON wire compatibility — no `#[serde(rename)]` needed since the Rust field name is already the wire name.
- Unset `source`/`scene` on a dropped-but-unconfigured action is represented as `""` (empty string), never `Option<String>` — execution fails with `ActionError::Failed("<field> not set")` when empty, checked before calling `obws`.
- `obws` request/response types referenced below are from `obws` 0.15.0 (verified against `~/.cargo/registry/src/.../obws-0.15.0/src/`): `Client::recording/streaming/virtual_cam/ui/inputs/scene_items/transitions/scenes`, `requests::inputs::{InputId, Volume}`, `requests::scenes::SceneId`, `requests::scene_items::{Id, SetEnabled}`.

---

## Task 1: Rust action model (`sped-mapping`)

**Files:**
- Modify: `crates/mapping/src/action.rs`
- Modify: `crates/mapping/src/lib.rs`
- Modify: `crates/mapping/src/engine.rs:117` (test fixture uses the removed `ObsAction::StartRecording`)
- Test: `crates/mapping/src/action.rs` (new `#[cfg(test)]` module, same file)

**Interfaces:**
- Produces: `ObsAction` variants `SwitchScene { scene: String }`, `Recording { mode: RecordingMode }`, `Streaming { mode: StartStopToggle }`, `VirtualCam { mode: StartStopToggle }`, `StudioMode { mode: StudioModeMode }`, `SourceMute { source: String, mode: MuteMode }`, `SourceVisibility { scene: String, source: String, mode: VisibilityMode }`, `SourceVolume { source: String, mode: VolumeMode }`.
- Produces: `RecordingMode` (`Start | Stop | Pause | Resume | Toggle`), `StartStopToggle` (`Start | Stop | Toggle`), `StudioModeMode` (`Enable | Disable | Toggle | TriggerTransition`), `MuteMode` (`Mute | Unmute | Toggle`), `VisibilityMode` (`Show | Hide | Toggle`), `VolumeMode` (`Absolute { percent: f32 } | Relative { delta_percent: f32 }`), all `pub`, re-exported from `sped_mapping`.
- Consumes: nothing new (only `serde`).

- [ ] **Step 1: Replace `ObsAction` and add the mode enums**

Replace the whole `ObsAction` definition in `crates/mapping/src/action.rs` (the existing `SwitchScene`/`StartRecording`/etc. enum) with:

```rust
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

/// `percent`/`delta_percent` are plain percentages (100.0 = unity gain),
/// converted to `obws`'s linear `mul` at the execution boundary
/// (`sped-integrations::obs`) -- never stored as `mul` so the UI can show
/// a human percentage directly.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum VolumeMode {
    Absolute { percent: f32 },
    Relative { delta_percent: f32 },
}
```

- [ ] **Step 2: Update `lib.rs` exports**

In `crates/mapping/src/lib.rs`, change:

```rust
pub use action::{Action, KeyboardAction, ObsAction};
```

to:

```rust
pub use action::{
    Action, KeyboardAction, MuteMode, ObsAction, RecordingMode, StartStopToggle, StudioModeMode,
    VisibilityMode, VolumeMode,
};
```

- [ ] **Step 3: Fix the now-broken test fixture in `engine.rs`**

In `crates/mapping/src/engine.rs`, the test `multiple_actions_execute_in_declared_order` (around line 117) has:

```rust
let second = Action::Obs(crate::action::ObsAction::StartRecording);
```

Change it to:

```rust
let second = Action::Obs(crate::action::ObsAction::Recording {
    mode: crate::action::RecordingMode::Toggle,
});
```

- [ ] **Step 4: Run the mapping crate's existing tests to confirm nothing else references removed variants**

Run: `cargo test -p sped-mapping`
Expected: FAIL to compile at this point only if another reference was missed — if so, grep `crates/` for `ObsAction::` and fix it the same way as Step 3. If it compiles and passes, continue to Step 5 (the round-trip tests don't exist yet).

- [ ] **Step 5: Write round-trip serde tests for every new variant**

Add to the bottom of `crates/mapping/src/action.rs`:

```rust
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
            mode: VolumeMode::Absolute { percent: 75.0 },
        });
        round_trips(&ObsAction::SourceVolume {
            source: "Mic".into(),
            mode: VolumeMode::Relative { delta_percent: -10.0 },
        });
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
```

- [ ] **Step 6: Run the new tests**

Run: `cargo test -p sped-mapping`
Expected: PASS, all tests including the 9 new ones in `action.rs`.

- [ ] **Step 7: Commit**

```bash
git add crates/mapping/src/action.rs crates/mapping/src/lib.rs crates/mapping/src/engine.rs
git commit -m "$(cat <<'EOF'
Replace flat OBS actions with grouped, mode-based action families

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rust OBS execution (`sped-integrations`)

**Files:**
- Modify: `crates/integrations/src/obs.rs`
- Modify: `crates/integrations/src/keyboard.rs:144` (test fixture uses the removed `ObsAction::StartRecording`)

**Interfaces:**
- Consumes: `sped_mapping::{ObsAction, RecordingMode, StartStopToggle, StudioModeMode, MuteMode, VisibilityMode, VolumeMode}` (Task 1).
- Produces: `ObsStatus::Connected { scenes: Vec<String>, inputs: Vec<String> }` (was `{ scenes: Vec<String> }`); `ObsIntegration::scene_items(&self, scene: String) -> Result<Vec<String>, String>`.

- [ ] **Step 1: Fix the now-broken test fixture in `keyboard.rs`**

In `crates/integrations/src/keyboard.rs`, the test `non_keyboard_action_is_unsupported` (around line 144) has:

```rust
let action = Action::Obs(sped_mapping::ObsAction::StartRecording);
```

Change it to:

```rust
let action = Action::Obs(sped_mapping::ObsAction::Recording {
    mode: sped_mapping::RecordingMode::Toggle,
});
```

- [ ] **Step 2: Run to confirm it compiles again (execution logic not yet updated, so `run_action` will fail to compile until Step 4)**

Run: `cargo check -p sped-integrations`
Expected: FAIL — `crates/integrations/src/obs.rs`'s `run_action` still matches on the old `ObsAction` variants. This is expected; continue to Step 3.

- [ ] **Step 3: Add `inputs` to `ObsStatus` and fetch it at connect**

In `crates/integrations/src/obs.rs`, change the `ObsStatus::Connected` variant:

```rust
    Connected {
        scenes: Vec<String>,
    },
```

to:

```rust
    Connected {
        scenes: Vec<String>,
        inputs: Vec<String>,
    },
```

Then in `ObsIntegration::connect`, replace the block that fetches scenes:

```rust
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
```

with:

```rust
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
```

And its consumer, currently:

```rust
            let mut guard = state.lock().unwrap();
            match outcome {
                Ok((client, scenes)) => {
                    guard.status = ObsStatus::Connected { scenes };
                    guard.client = Some(Arc::new(client));
                }
```

becomes:

```rust
            let mut guard = state.lock().unwrap();
            match outcome {
                Ok((client, scenes, inputs)) => {
                    guard.status = ObsStatus::Connected { scenes, inputs };
                    guard.client = Some(Arc::new(client));
                }
```

- [ ] **Step 4: Rewrite `run_action`'s match and add `scene_items`**

Update the imports at the top of `crates/integrations/src/obs.rs`:

```rust
use obws::Client;
use serde::Serialize;
use sped_mapping::{Action, ActionError, ActionExecutor, ObsAction};
```

to:

```rust
use obws::requests::inputs::{InputId, Volume};
use obws::requests::scene_items::{Id as SceneItemId, SetEnabled};
use obws::requests::scenes::SceneId;
use obws::Client;
use serde::Serialize;
use sped_mapping::{
    Action, ActionError, ActionExecutor, MuteMode, ObsAction, RecordingMode, StartStopToggle,
    StudioModeMode, VisibilityMode, VolumeMode,
};
```

Replace the body of `run_action`'s `match action { ... }` (currently the six `ObsAction::SwitchScene`/`StartRecording`/etc. arms) with:

```rust
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
```

(This replaces both the `let result = match action { ... };` block and the trailing `result.map_err(...)` line that already existed at the end of the `async move` block — don't duplicate the `result.map_err` line.)

- [ ] **Step 5: Add `ObsIntegration::scene_items`**

Add this method to `impl ObsIntegration` in `crates/integrations/src/obs.rs`, right after `run_action`:

```rust
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
```

- [ ] **Step 6: Run tests for both crates**

Run: `cargo test -p sped-mapping -p sped-integrations`
Expected: PASS.

- [ ] **Step 7: Full workspace check**

Run: `cargo check --workspace`
Expected: FAIL only in `src-tauri` (Task 3 hasn't updated its `ObsStatus`-shaped code yet, if any exists) — check the output. If `src-tauri` doesn't reference `ObsStatus::Connected`'s fields directly, this should PASS; if it does, note it for Task 3 but don't fix it here.

- [ ] **Step 8: Commit**

```bash
git add crates/integrations/src/obs.rs crates/integrations/src/keyboard.rs
git commit -m "$(cat <<'EOF'
Execute grouped OBS actions against obws, add live inputs/scene-items lookup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tauri command (`src-tauri`)

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `ObsIntegration::scene_items(&self, scene: String) -> Result<Vec<String>, String>` (Task 2); `state.obs: Arc<ObsIntegration>` (existing `AppState` field, `src-tauri/src/state.rs:14`).
- Produces: Tauri command `obs_scene_items(state, scene: String) -> Result<Vec<String>, String>`, registered in `invoke_handler`.

- [ ] **Step 1: Add the command**

In `src-tauri/src/commands.rs`, add this right after `obs_status` (around line 226):

```rust
#[tauri::command]
pub fn obs_scene_items(state: State<AppState>, scene: String) -> Result<Vec<String>, String> {
    state.obs.scene_items(scene)
}
```

- [ ] **Step 2: Register it**

In `src-tauri/src/lib.rs`, add `commands::obs_scene_items,` to the `invoke_handler(tauri::generate_handler![...])` list, right after `commands::obs_status,` (line 47).

- [ ] **Step 3: Build the Tauri crate**

Run: `cargo check -p speed-editor-control`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "$(cat <<'EOF'
Add obs_scene_items Tauri command for on-demand scene-item lookup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend type mirror (`src/types.ts`)

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: TS types `RecordingMode`, `StartStopToggle`, `StudioModeMode`, `MuteMode`, `VisibilityMode`, `VolumeMode`, `ObsRecording`, `ObsStreaming`, `ObsVirtualCam`, `ObsStudioMode`, `ObsSourceMute`, `ObsSourceVisibility`, `ObsSourceVolume`; updated `ObsAction` union; updated `ObsStatus` (`Connected` variant gains `inputs: string[]`); updated `actionLabel`/`actionCategory`.
- Consumes: nothing new.

- [ ] **Step 1: Replace `ObsSimple` and `ObsAction` with the grouped variants**

Replace:

```ts
export interface ObsSimple {
  kind: "obs";
  op:
    | "start_recording"
    | "stop_recording"
    | "pause_recording"
    | "resume_recording"
    | "start_streaming"
    | "stop_streaming";
}

export type ObsAction = ObsSwitchScene | ObsSimple;
```

with:

```ts
export type RecordingMode = "start" | "stop" | "pause" | "resume" | "toggle";
export type StartStopToggle = "start" | "stop" | "toggle";
export type StudioModeMode = "enable" | "disable" | "toggle" | "trigger_transition";
export type MuteMode = "mute" | "unmute" | "toggle";
export type VisibilityMode = "show" | "hide" | "toggle";

export type VolumeMode =
  | { kind: "absolute"; percent: number }
  | { kind: "relative"; delta_percent: number };

export interface ObsRecording {
  kind: "obs";
  op: "recording";
  mode: RecordingMode;
}

export interface ObsStreaming {
  kind: "obs";
  op: "streaming";
  mode: StartStopToggle;
}

export interface ObsVirtualCam {
  kind: "obs";
  op: "virtual_cam";
  mode: StartStopToggle;
}

export interface ObsStudioMode {
  kind: "obs";
  op: "studio_mode";
  mode: StudioModeMode;
}

export interface ObsSourceMute {
  kind: "obs";
  op: "source_mute";
  source: string;
  mode: MuteMode;
}

export interface ObsSourceVisibility {
  kind: "obs";
  op: "source_visibility";
  scene: string;
  source: string;
  mode: VisibilityMode;
}

export interface ObsSourceVolume {
  kind: "obs";
  op: "source_volume";
  source: string;
  mode: VolumeMode;
}

export type ObsAction =
  | ObsSwitchScene
  | ObsRecording
  | ObsStreaming
  | ObsVirtualCam
  | ObsStudioMode
  | ObsSourceMute
  | ObsSourceVisibility
  | ObsSourceVolume;
```

- [ ] **Step 2: Update `ObsStatus`**

Change:

```ts
export type ObsStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; scenes: string[] }
  | { state: "error"; message: string };
```

to:

```ts
export type ObsStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; scenes: string[]; inputs: string[] }
  | { state: "error"; message: string };
```

- [ ] **Step 3: Rewrite `actionLabel` and add mode-label lookup tables**

Replace the existing `actionLabel` function (the one with the `switch (action.op)` over `switch_scene`/`start_recording`/etc.) with:

```ts
const RECORDING_MODE_LABEL: Record<RecordingMode, string> = {
  start: "Start",
  stop: "Stop",
  pause: "Pause",
  resume: "Resume",
  toggle: "Toggle",
};

const START_STOP_TOGGLE_LABEL: Record<StartStopToggle, string> = {
  start: "Start",
  stop: "Stop",
  toggle: "Toggle",
};

const STUDIO_MODE_LABEL: Record<StudioModeMode, string> = {
  enable: "Enable",
  disable: "Disable",
  toggle: "Toggle",
  trigger_transition: "Trigger Transition",
};

const MUTE_MODE_LABEL: Record<MuteMode, string> = {
  mute: "Mute",
  unmute: "Unmute",
  toggle: "Toggle",
};

const VISIBILITY_MODE_LABEL: Record<VisibilityMode, string> = {
  show: "Show",
  hide: "Hide",
  toggle: "Toggle",
};

export function actionLabel(action: Action): string {
  if (action.kind === "keyboard") {
    return action.keys.join(" + ");
  }
  switch (action.op) {
    case "switch_scene":
      return `Switch Scene → ${action.scene}`;
    case "recording":
      return `Recording — ${RECORDING_MODE_LABEL[action.mode]}`;
    case "streaming":
      return `Streaming — ${START_STOP_TOGGLE_LABEL[action.mode]}`;
    case "virtual_cam":
      return `Virtual Camera — ${START_STOP_TOGGLE_LABEL[action.mode]}`;
    case "studio_mode":
      return `Studio Mode — ${STUDIO_MODE_LABEL[action.mode]}`;
    case "source_mute":
      return `Source Mute (${action.source || "unset"}) — ${MUTE_MODE_LABEL[action.mode]}`;
    case "source_visibility":
      return `Source Visibility (${action.source || "unset"}) — ${VISIBILITY_MODE_LABEL[action.mode]}`;
    case "source_volume":
      return action.mode.kind === "absolute"
        ? `Source Volume (${action.source || "unset"}) — ${action.mode.percent}%`
        : `Source Volume (${action.source || "unset"}) — ${action.mode.delta_percent >= 0 ? "+" : ""}${action.mode.delta_percent}%`;
  }
}
```

`actionCategory` is unchanged (it only branches on `action.kind`, not `op`).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: FAIL — `ActionsSidebar.tsx` still constructs the old flat payloads (`op: "start_recording"` etc.) as untyped `object` literals so it may not error yet, but `ObsStatus.Connected` now requires `inputs`, which `App.tsx`/`SettingsModal.tsx`/anywhere else constructing a literal `ObsStatus` would fail on — check the actual error list. This is expected to be fixed across Tasks 5–7; don't fix it here, just confirm the error is exactly the `inputs`-shaped ones (and not something unrelated you introduced).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "$(cat <<'EOF'
Mirror grouped OBS action model and connected-status inputs in types.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend API wrapper (`src/api.ts`)

**Files:**
- Modify: `src/api.ts`

**Interfaces:**
- Consumes: Tauri command `obs_scene_items` (Task 3).
- Produces: `api.obsSceneItems(scene: string) => Promise<string[]>`.

- [ ] **Step 1: Add the wrapper**

In `src/api.ts`, add right after `obsStatus: () => invoke<ObsStatus>("obs_status"),`:

```ts
  obsSceneItems: (scene: string) => invoke<string[]>("obs_scene_items", { scene }),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: Same set of `inputs`-related errors as Task 4 Step 4, no new ones introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "$(cat <<'EOF'
Add obsSceneItems API wrapper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Sidebar family cards (`ActionsSidebar.tsx`)

**Files:**
- Modify: `src/components/ActionsSidebar.tsx`

**Interfaces:**
- Consumes: `ObsAction` union and `ObsStatus` (Task 4).
- Produces: no new exports; `ActionsSidebar` drags one card per OBS family instead of one per flat operation.

- [ ] **Step 1: Replace `OBS_TRANSPORT_ITEMS` with family cards**

Replace:

```ts
const OBS_TRANSPORT_ITEMS: { label: string; op: string }[] = [
  { label: "Start Recording", op: "start_recording" },
  { label: "Stop Recording", op: "stop_recording" },
  { label: "Pause Recording", op: "pause_recording" },
  { label: "Resume Recording", op: "resume_recording" },
  { label: "Start Streaming", op: "start_streaming" },
  { label: "Stop Streaming", op: "stop_streaming" },
];
```

with:

```ts
import type { ObsAction } from "../types";

const OBS_FAMILY_ITEMS: { label: string; subcategory: string; payload: ObsAction }[] = [
  {
    label: "Recording Control",
    subcategory: "Transport",
    payload: { kind: "obs", op: "recording", mode: "toggle" },
  },
  {
    label: "Streaming Control",
    subcategory: "Transport",
    payload: { kind: "obs", op: "streaming", mode: "toggle" },
  },
  {
    label: "Virtual Camera",
    subcategory: "Transport",
    payload: { kind: "obs", op: "virtual_cam", mode: "toggle" },
  },
  {
    label: "Studio Mode",
    subcategory: "Transport",
    payload: { kind: "obs", op: "studio_mode", mode: "toggle" },
  },
  {
    label: "Source Mute",
    subcategory: "Sources",
    payload: { kind: "obs", op: "source_mute", source: "", mode: "toggle" },
  },
  {
    label: "Source Visibility",
    subcategory: "Sources",
    payload: { kind: "obs", op: "source_visibility", scene: "", source: "", mode: "toggle" },
  },
  {
    label: "Source Volume",
    subcategory: "Sources",
    payload: {
      kind: "obs",
      op: "source_volume",
      source: "",
      mode: { kind: "absolute", percent: 100 },
    },
  },
];
```

(Add the `import type { ObsAction } from "../types";` line near the top with the other imports rather than inline — place it alongside the existing `import { OBS_STATUS_COLOR, obsStatusLabel, type ObsStatus } from "../types";` line, e.g. combine into one import statement: `import { OBS_STATUS_COLOR, obsStatusLabel, type ObsAction, type ObsStatus } from "../types";` and drop the separate `import type` line.)

- [ ] **Step 2: Update the search-flattening `useMemo`**

Replace:

```ts
    for (const item of OBS_TRANSPORT_ITEMS) {
      entries.push({
        label: item.label,
        payload: { kind: "obs", op: item.op },
        category: "OBS Studio",
        subcategory: "Transport",
      });
    }
```

with:

```ts
    for (const item of OBS_FAMILY_ITEMS) {
      entries.push({
        label: item.label,
        payload: item.payload,
        category: "OBS Studio",
        subcategory: item.subcategory,
      });
    }
```

- [ ] **Step 3: Update the grouped (non-search) render**

Replace:

```ts
              <div className="mt-2 mb-1 text-[10px] tracking-wide text-text-muted uppercase">
                Transport
              </div>
              {OBS_TRANSPORT_ITEMS.map((item) => (
                <DraggableItem key={item.op} label={item.label} payload={{ kind: "obs", op: item.op }} />
              ))}
```

with:

```ts
              <div className="mt-2 mb-1 text-[10px] tracking-wide text-text-muted uppercase">
                Transport
              </div>
              {OBS_FAMILY_ITEMS.filter((item) => item.subcategory === "Transport").map((item) => (
                <DraggableItem key={item.label} label={item.label} payload={item.payload} />
              ))}
              <div className="mt-2 mb-1 text-[10px] tracking-wide text-text-muted uppercase">
                Sources
              </div>
              {OBS_FAMILY_ITEMS.filter((item) => item.subcategory === "Sources").map((item) => (
                <DraggableItem key={item.label} label={item.label} payload={item.payload} />
              ))}
```

- [ ] **Step 4: Update `DraggableItem`'s `payload` prop type**

The `payload: object` field on `DraggableItemProps` (and on `ActionEntry`) already accepts `ObsAction` structurally, so no change is required there — but confirm this compiles rather than assuming it.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: The `inputs`-shaped `ObsStatus` errors from Task 4 may still be present (fixed in Task 7); no errors originating from `ActionsSidebar.tsx` itself.

- [ ] **Step 6: Manual smoke test**

Run: `npm run tauri dev`
In the running app, open the Actions Sidebar and confirm: "Recording Control", "Streaming Control", "Virtual Camera", "Studio Mode" appear under Transport, and "Source Mute", "Source Visibility", "Source Volume" appear under Sources. Type "volume" in the search box and confirm "Source Volume" appears with breadcrumb "OBS Studio / Sources".

- [ ] **Step 7: Commit**

```bash
git add src/components/ActionsSidebar.tsx
git commit -m "$(cat <<'EOF'
Replace per-operation OBS sidebar items with one draggable card per family

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Properties Panel inline editing + App wiring

**Files:**
- Modify: `src/components/PropertiesPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `api.obsSceneItems` (Task 5); `ObsAction`, `ObsStatus`, `RecordingMode`, `StartStopToggle`, `StudioModeMode`, `MuteMode`, `VisibilityMode` (Task 4).
- Produces: `PropertiesPanelProps.onUpdateAction: (index: number, action: Action) => void`; `PropertiesPanelProps.obsStatus: ObsStatus`; `App.tsx`'s `updateActionInControl(control, index, action)`.

- [ ] **Step 1: Extend `PropertiesPanelProps` and imports**

In `src/components/PropertiesPanel.tsx`, change:

```tsx
import { X } from "lucide-react";
import { useState } from "react";
import { ShortcutRecorder } from "../cscl-ui/inputs/ShortcutRecorder";
import { IconButton } from "../cscl-ui/primitives/IconButton";
import { actionCategory, actionLabel, comboStringToKeys, type Action, type ControlId } from "../types";

export interface PropertiesPanelProps {
  control: ControlId | null;
  actions: Action[];
  onAddAction: (action: Action) => void;
  onRemoveAction: (index: number) => void;
}
```

to:

```tsx
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ShortcutRecorder } from "../cscl-ui/inputs/ShortcutRecorder";
import { IconButton } from "../cscl-ui/primitives/IconButton";
import {
  actionCategory,
  actionLabel,
  comboStringToKeys,
  type Action,
  type ControlId,
  type MuteMode,
  type ObsAction,
  type ObsStatus,
  type RecordingMode,
  type StartStopToggle,
  type StudioModeMode,
  type VisibilityMode,
} from "../types";

export interface PropertiesPanelProps {
  control: ControlId | null;
  actions: Action[];
  obsStatus: ObsStatus;
  onAddAction: (action: Action) => void;
  onRemoveAction: (index: number) => void;
  onUpdateAction: (index: number, action: Action) => void;
}
```

- [ ] **Step 2: Add mode-option tables and the `ObsActionEditor` component**

Add this above the `export function PropertiesPanel` declaration:

```tsx
const SELECT_CLASS =
  "w-full rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text focus:border-accent focus:outline-none";

const RECORDING_MODES: { value: RecordingMode; label: string }[] = [
  { value: "toggle", label: "Toggle" },
  { value: "start", label: "Start" },
  { value: "stop", label: "Stop" },
  { value: "pause", label: "Pause" },
  { value: "resume", label: "Resume" },
];

const START_STOP_TOGGLE_MODES: { value: StartStopToggle; label: string }[] = [
  { value: "toggle", label: "Toggle" },
  { value: "start", label: "Start" },
  { value: "stop", label: "Stop" },
];

const STUDIO_MODE_MODES: { value: StudioModeMode; label: string }[] = [
  { value: "toggle", label: "Toggle" },
  { value: "enable", label: "Enable" },
  { value: "disable", label: "Disable" },
  { value: "trigger_transition", label: "Trigger Transition" },
];

const MUTE_MODES: { value: MuteMode; label: string }[] = [
  { value: "toggle", label: "Toggle" },
  { value: "mute", label: "Mute" },
  { value: "unmute", label: "Unmute" },
];

const VISIBILITY_MODES: { value: VisibilityMode; label: string }[] = [
  { value: "toggle", label: "Toggle" },
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
];

interface ObsActionEditorProps {
  action: ObsAction;
  obsStatus: ObsStatus;
  onChange: (action: ObsAction) => void;
}

function ObsActionEditor({ action, obsStatus, onChange }: ObsActionEditorProps) {
  const inputs = obsStatus.state === "connected" ? obsStatus.inputs : [];
  const scenes = obsStatus.state === "connected" ? obsStatus.scenes : [];
  const [sceneItems, setSceneItems] = useState<string[]>([]);

  const visibilityScene = action.op === "source_visibility" ? action.scene : "";

  useEffect(() => {
    if (!visibilityScene) {
      setSceneItems([]);
      return;
    }
    let cancelled = false;
    api
      .obsSceneItems(visibilityScene)
      .then((items) => {
        if (!cancelled) setSceneItems(items);
      })
      .catch(() => {
        if (!cancelled) setSceneItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visibilityScene]);

  switch (action.op) {
    case "switch_scene":
      return null;

    case "recording":
      return (
        <select
          className={SELECT_CLASS}
          value={action.mode}
          onChange={(e) => onChange({ ...action, mode: e.target.value as RecordingMode })}
        >
          {RECORDING_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      );

    case "streaming":
    case "virtual_cam":
      return (
        <select
          className={SELECT_CLASS}
          value={action.mode}
          onChange={(e) => onChange({ ...action, mode: e.target.value as StartStopToggle })}
        >
          {START_STOP_TOGGLE_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      );

    case "studio_mode":
      return (
        <select
          className={SELECT_CLASS}
          value={action.mode}
          onChange={(e) => onChange({ ...action, mode: e.target.value as StudioModeMode })}
        >
          {STUDIO_MODE_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      );

    case "source_mute":
      return (
        <div className="flex flex-col gap-1.5">
          <select
            className={SELECT_CLASS}
            value={action.source}
            onChange={(e) => onChange({ ...action, source: e.target.value })}
          >
            <option value="">Select source…</option>
            {inputs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={action.mode}
            onChange={(e) => onChange({ ...action, mode: e.target.value as MuteMode })}
          >
            {MUTE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "source_visibility":
      return (
        <div className="flex flex-col gap-1.5">
          <select
            className={SELECT_CLASS}
            value={action.scene}
            onChange={(e) => onChange({ ...action, scene: e.target.value, source: "" })}
          >
            <option value="">Select scene…</option>
            {scenes.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={action.source}
            disabled={!action.scene}
            onChange={(e) => onChange({ ...action, source: e.target.value })}
          >
            <option value="">Select source…</option>
            {sceneItems.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={action.mode}
            onChange={(e) => onChange({ ...action, mode: e.target.value as VisibilityMode })}
          >
            {VISIBILITY_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "source_volume":
      return (
        <div className="flex flex-col gap-1.5">
          <select
            className={SELECT_CLASS}
            value={action.source}
            onChange={(e) => onChange({ ...action, source: e.target.value })}
          >
            <option value="">Select source…</option>
            {inputs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={action.mode.kind}
            onChange={(e) =>
              onChange({
                ...action,
                mode:
                  e.target.value === "absolute"
                    ? { kind: "absolute", percent: 100 }
                    : { kind: "relative", delta_percent: 10 },
              })
            }
          >
            <option value="absolute">Absolute</option>
            <option value="relative">Relative</option>
          </select>
          {action.mode.kind === "absolute" ? (
            <input
              type="number"
              className={SELECT_CLASS}
              value={action.mode.percent}
              onChange={(e) =>
                onChange({
                  ...action,
                  mode: { kind: "absolute", percent: Number(e.target.value) },
                })
              }
            />
          ) : (
            <input
              type="number"
              className={SELECT_CLASS}
              value={action.mode.delta_percent}
              onChange={(e) =>
                onChange({
                  ...action,
                  mode: { kind: "relative", delta_percent: Number(e.target.value) },
                })
              }
            />
          )}
        </div>
      );
  }
}
```

- [ ] **Step 3: Thread `obsStatus`/`onUpdateAction` through and render the editor**

Change the function signature:

```tsx
export function PropertiesPanel({ control, actions, onAddAction, onRemoveAction }: PropertiesPanelProps) {
```

to:

```tsx
export function PropertiesPanel({
  control,
  actions,
  obsStatus,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
}: PropertiesPanelProps) {
```

Then, in the `actions.map` list rendering, replace:

```tsx
          <ul className="mb-3 flex flex-col gap-1.5">
            {actions.map((action, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-2.5 py-2"
              >
                <div>
                  <div className="text-[10px] tracking-wide text-text-muted uppercase">
                    {actionCategory(action)}
                  </div>
                  <div className="text-sm font-medium text-text">{actionLabel(action)}</div>
                </div>
                <IconButton
                  aria-label="Remove action"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAction(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
```

with:

```tsx
          <ul className="mb-3 flex flex-col gap-1.5">
            {actions.map((action, index) => (
              <li
                key={index}
                className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-raised px-2.5 py-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] tracking-wide text-text-muted uppercase">
                      {actionCategory(action)}
                    </div>
                    <div className="text-sm font-medium text-text">{actionLabel(action)}</div>
                  </div>
                  <IconButton
                    aria-label="Remove action"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveAction(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
                {action.kind === "obs" && (
                  <ObsActionEditor
                    action={action}
                    obsStatus={obsStatus}
                    onChange={(next) => onUpdateAction(index, next)}
                  />
                )}
              </li>
            ))}
          </ul>
```

- [ ] **Step 4: Wire it up in `App.tsx`**

In `src/App.tsx`, add a new callback right after `removeActionFromControl` (around line 232):

```tsx
  const updateActionInControl = useCallback(
    async (control: ControlId, index: number, action: Action) => {
      const profile = await api.getActiveProfile();
      const existing = profile.mappings[control] ?? [];
      const others = existing.filter((m) => !(m.trigger === "press" && m.modifier === "none"));
      const current = existing.find((m) => m.trigger === "press" && m.modifier === "none");
      if (!current) return;
      const nextActions = current.actions.map((a, i) => (i === index ? action : a));
      await saveMappingsForControl(control, [...others, { ...current, actions: nextActions }]);
    },
    [saveMappingsForControl],
  );
```

Then update the `<PropertiesPanel />` usage (around line 316):

```tsx
        <PropertiesPanel
          control={selected}
          actions={actionsForSelected}
          onAddAction={(action) => selected && addActionToControl(selected, action)}
          onRemoveAction={(index) => selected && removeActionFromControl(selected, index)}
        />
```

to:

```tsx
        <PropertiesPanel
          control={selected}
          actions={actionsForSelected}
          obsStatus={obsStatus}
          onAddAction={(action) => selected && addActionToControl(selected, action)}
          onRemoveAction={(index) => selected && removeActionFromControl(selected, index)}
          onUpdateAction={(index, action) => selected && updateActionInControl(selected, index, action)}
        />
```

- [ ] **Step 5: Type-check the whole project**

Run: `npx tsc --noEmit -p .`
Expected: PASS with no errors (this resolves the `ObsStatus.inputs` errors noted in Tasks 4–6, since every construction site is now updated).

- [ ] **Step 6: Manual smoke test**

Run: `npm run tauri dev` (with a real OBS instance running, obs-websocket enabled, and at least one audio input and one scene with a source in it)
1. Connect to OBS via the Settings modal.
2. Drag "Source Volume" onto a control, select it, and confirm the Properties Panel shows a source `<select>` populated with real OBS inputs, an Absolute/Relative toggle, and a number field.
3. Drag "Source Visibility" onto a control, pick a scene, and confirm the source `<select>` populates with that scene's items after the scene is chosen (not before).
4. Change a "Recording Control" action's mode to "Start", press the mapped control, and confirm OBS starts recording (not toggles).
5. Confirm removing/re-adding actions and switching between controls doesn't lose in-progress edits unexpectedly (edits are saved to the profile on every change, so reselecting the same control should show the last-saved configuration).

- [ ] **Step 7: Commit**

```bash
git add src/components/PropertiesPanel.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Make OBS actions inline-editable in the Properties Panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
