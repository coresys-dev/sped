# HUD Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a togglable HUD overlay — a small, click-through, always-on-top toast stack, excluded from screen capture — that shows which control fired, what action it resolved to, and the resulting state.

**Architecture:** A new `ActionOutcome` return value threads from each `ActionExecutor` through the `Dispatcher` to the device thread, which emits it as an `hud-event` to a second Tauri window (`"hud"`) that renders toasts and is excluded from capture via Win32's `SetWindowDisplayAffinity`.

**Tech Stack:** Rust (Tauri 2.11, `obws` 0.15, `windows` 0.61), React/TypeScript (existing `cscl-ui` primitives).

**Spec:** `docs/superpowers/specs/2026-09-17-hud-overlay-design.md`

## Global Constraints

- `windows` crate version must stay `0.61` to match the version `tauri` itself depends on for `HWND` — a mismatched version creates two incompatible `HWND` types and fails to compile.
- Capture-exclusion is Windows-only; failure to apply it (pre-Windows-10-2004) must degrade gracefully (log + continue), never block the HUD window from opening.
- No new frontend router — the same SPA bundle renders either `App` or `HudOverlay` based on `getCurrentWindow().label`, decided in `main.tsx` before any hooks run.
- `HudSettings`/`HudCorner` use `#[serde(default)]` throughout so existing `settings.json` files without a `hud` key still load.
- Every `ActionExecutor::execute` implementation must be updated in the same commit as the trait signature change — the crate must compile at every commit.

---

## Task 1: `ActionOutcome` type and `ActionExecutor`/`Dispatcher` signature change

**Files:**
- Modify: `crates/mapping/src/executor.rs`
- Modify: `crates/mapping/src/dispatch.rs`
- Modify: `crates/mapping/src/lib.rs`

**Interfaces:**
- Produces: `pub struct ActionOutcome { pub result: Option<String> }` with `ActionOutcome::none() -> Self` and `ActionOutcome::with_result(impl Into<String>) -> Self`; `pub trait ActionExecutor { fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError>; }`; `Dispatcher::execute(&self, action: &Action) -> Result<ActionOutcome, ActionError>` (unchanged name, new return type). `Dispatcher::execute_all` is removed (its only caller, `device_manager.rs`, moves to per-action execution in Task 7 — see Task 7 for why).

- [ ] **Step 1: Rewrite `executor.rs` with `ActionOutcome` and the new trait signature**

```rust
use crate::action::Action;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ActionError {
    #[error("no executor registered for this action")]
    Unsupported,
    #[error("action failed: {0}")]
    Failed(String),
}

/// What executing an [`Action`] actually did, for surfacing to the user
/// (the HUD overlay) beyond a bare success/failure. `None` for actions
/// with no meaningful resulting state to report (e.g. keyboard shortcuts).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ActionOutcome {
    pub result: Option<String>,
}

impl ActionOutcome {
    /// No meaningful result to report.
    pub fn none() -> Self {
        Self::default()
    }

    /// A human-readable resulting state, e.g. `"-4 dB"`, `"muted"`,
    /// `"Scene 2"`.
    pub fn with_result(result: impl Into<String>) -> Self {
        Self { result: Some(result.into()) }
    }
}

/// Runs a single [`Action`]. Implemented per-integration in
/// `sped-integrations` (keyboard, OBS, ...) and composed by
/// [`crate::dispatch::Dispatcher`].
pub trait ActionExecutor: Send + Sync {
    fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn none_has_no_result() {
        assert_eq!(ActionOutcome::none().result, None);
    }

    #[test]
    fn with_result_wraps_the_string() {
        assert_eq!(ActionOutcome::with_result("-4 dB").result, Some("-4 dB".to_string()));
    }
}
```

- [ ] **Step 2: Rewrite `dispatch.rs`: `execute` returns `ActionOutcome`, `execute_all` removed, add tests**

```rust
use crate::action::Action;
use crate::executor::{ActionError, ActionExecutor, ActionOutcome};

/// Fans an [`Action`] out to whichever registered executor claims it.
/// Executors signal "not mine" by returning `ActionError::Unsupported`.
#[derive(Default)]
pub struct Dispatcher {
    executors: Vec<Box<dyn ActionExecutor>>,
}

impl Dispatcher {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, executor: Box<dyn ActionExecutor>) {
        self.executors.push(executor);
    }

    pub fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError> {
        for executor in &self.executors {
            match executor.execute(action) {
                Err(ActionError::Unsupported) => continue,
                other => return other,
            }
        }
        Err(ActionError::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::action::{Action, KeyboardAction};

    struct AlwaysUnsupported;
    impl ActionExecutor for AlwaysUnsupported {
        fn execute(&self, _action: &Action) -> Result<ActionOutcome, ActionError> {
            Err(ActionError::Unsupported)
        }
    }

    struct EchoExecutor;
    impl ActionExecutor for EchoExecutor {
        fn execute(&self, _action: &Action) -> Result<ActionOutcome, ActionError> {
            Ok(ActionOutcome::with_result("done"))
        }
    }

    fn ctrl_b() -> Action {
        Action::Keyboard(KeyboardAction { keys: vec!["CTRL".into(), "B".into()] })
    }

    #[test]
    fn falls_through_unsupported_executors_to_the_next() {
        let mut dispatcher = Dispatcher::new();
        dispatcher.register(Box::new(AlwaysUnsupported));
        dispatcher.register(Box::new(EchoExecutor));

        let outcome = dispatcher.execute(&ctrl_b()).unwrap();
        assert_eq!(outcome.result, Some("done".to_string()));
    }

    #[test]
    fn no_executor_claims_it_is_unsupported() {
        let dispatcher = Dispatcher::new();
        assert!(matches!(dispatcher.execute(&ctrl_b()), Err(ActionError::Unsupported)));
    }
}
```

- [ ] **Step 3: Export `ActionOutcome` from the crate root**

In `crates/mapping/src/lib.rs`, change:

```rust
pub use executor::{ActionError, ActionExecutor};
```

to:

```rust
pub use executor::{ActionError, ActionExecutor, ActionOutcome};
```

- [ ] **Step 4: Confirm the crate compiles (downstream crates will still be broken — that's Tasks 2-3)**

Run: `cargo check -p sped-mapping`
Expected: succeeds.

- [ ] **Step 5: Run the mapping crate's tests**

Run: `cargo test -p sped-mapping`
Expected: all pass, including the new `executor::tests::*` and `dispatch::tests::*`.

- [ ] **Step 6: Commit**

```bash
git add crates/mapping/src/executor.rs crates/mapping/src/dispatch.rs crates/mapping/src/lib.rs
git commit -m "Add ActionOutcome so executors can report what an action did"
```

---

## Task 2: Update `KeyboardExecutor` for the new trait signature

**Files:**
- Modify: `crates/integrations/src/keyboard.rs`

**Interfaces:**
- Consumes: `ActionOutcome::none()` from Task 1.
- Produces: `KeyboardExecutor` still implements `ActionExecutor`, now returning `Ok(ActionOutcome::none())` on success (keyboard shortcuts have no device-side state to report).

- [ ] **Step 1: Update the `execute` signature and success return**

In `crates/integrations/src/keyboard.rs`, change the import:

```rust
use sped_mapping::{Action, ActionError, ActionExecutor};
```

to:

```rust
use sped_mapping::{Action, ActionError, ActionExecutor, ActionOutcome};
```

Change the impl signature:

```rust
impl ActionExecutor for KeyboardExecutor {
    fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError> {
```

And the final line of the function body, from `Ok(())` to:

```rust
        Ok(ActionOutcome::none())
    }
}
```

- [ ] **Step 2: Run the integrations crate's existing tests to confirm nothing broke**

Run: `cargo test -p sped-integrations keyboard::`
Expected: `parses_modifiers_and_letters`, `rejects_unknown_names`, `non_keyboard_action_is_unsupported` all still pass unchanged.

- [ ] **Step 3: Commit**

```bash
git add crates/integrations/src/keyboard.rs
git commit -m "Update KeyboardExecutor for the ActionOutcome-returning executor trait"
```

---

## Task 3: Update `ObsExecutorHandle` in `src-tauri/src/state.rs`

**Files:**
- Modify: `src-tauri/src/state.rs`

**Interfaces:**
- Consumes: `ActionOutcome` from Task 1; `ObsIntegration::execute` (updated in Task 4, but its *signature* changes here too since `state.rs` won't compile against a mismatched trait — do this step first, `ObsIntegration::execute`'s body is fixed in Task 4).

- [ ] **Step 1: Update the import and the passthrough impl**

In `crates/mapping` import list, add `ActionOutcome`:

```rust
use sped_mapping::{Action, ActionError, ActionExecutor, ActionOutcome, Dispatcher, MappingEngine, Profile, ProfileError};
```

Change:

```rust
impl ActionExecutor for ObsExecutorHandle {
    fn execute(&self, action: &Action) -> Result<(), ActionError> {
        self.0.execute(action)
    }
}
```

to:

```rust
impl ActionExecutor for ObsExecutorHandle {
    fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError> {
        self.0.execute(action)
    }
}
```

- [ ] **Step 2: Confirm expected compile errors are now isolated to `sped-integrations::obs`**

Run: `cargo check -p sped-integrations 2>&1 | head -40`
Expected: errors only in `crates/integrations/src/obs.rs` (its `run_action`/`ActionExecutor for ObsIntegration` still returning `Result<(), ActionError>`) — this is expected and fixed in Task 4. `sped-mapping` and `speed-editor-control-lib` (`state.rs`) must show no errors related to this change (`speed-editor-control-lib` will still fail to fully build until Task 4 lands since it depends on `sped-integrations`, but there must be no error pointing at `state.rs` itself).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "Update ObsExecutorHandle for the ActionOutcome-returning executor trait"
```

---

## Task 4: Rewrite `ObsIntegration::run_action` to return `ActionOutcome`

**Files:**
- Modify: `crates/integrations/src/obs.rs`

**Interfaces:**
- Consumes: `ActionOutcome` from Task 1.
- Produces: `ObsIntegration::run_action(&self, action: ObsAction) -> Result<ActionOutcome, ActionError>`; `ActionExecutor for ObsIntegration` matches. New pure helper `fn format_volume(mul: f32, db: f32, unit: VolumeUnit) -> String` (unit-tested; the surrounding `run_action` itself is not unit-testable without a live OBS connection, matching this file's existing convention of zero live-client tests — verified manually in Task 14).

- [ ] **Step 1: Replace the `db_to_mul`/`mul_to_db` pair with `db_to_mul` + the new `format_volume` helper**

Replace:

```rust
/// Converts a dB value (as shown in OBS's mixer, 0 dB = unity gain) to the
/// linear multiplier `obws` expects.
fn db_to_mul(db: f32) -> f32 {
    10f32.powf(db / 20.0)
}

/// Inverse of [`db_to_mul`]. `mul <= 0.0` (fully muted) has no finite dB
/// value -- OBS's own UI floors its slider at -100 dB, so we do the same
/// rather than producing `-inf`.
fn mul_to_db(mul: f32) -> f32 {
    if mul <= 0.0 {
        -100.0
    } else {
        20.0 * mul.log10()
    }
}
```

with:

```rust
/// Converts a dB value (as shown in OBS's mixer, 0 dB = unity gain) to the
/// linear multiplier `obws` expects.
fn db_to_mul(db: f32) -> f32 {
    10f32.powf(db / 20.0)
}

/// Formats a volume reading in whichever unit the action itself was
/// configured with, so the HUD echoes back the same unit the user picked
/// in the Properties Panel rather than always converting to one. `db` is
/// read directly from OBS's own response (`InputVolume::db`) rather than
/// derived from `mul`, since OBS already computes it.
fn format_volume(mul: f32, db: f32, unit: VolumeUnit) -> String {
    match unit {
        VolumeUnit::Percent => format!("{:.0}%", mul * 100.0),
        VolumeUnit::Db => format!("{:.1} dB", db),
    }
}
```

- [ ] **Step 2: Update the import list**

```rust
use sped_mapping::{
    Action, ActionError, ActionExecutor, MuteMode, ObsAction, RecordingMode, StartStopToggle,
    StudioModeMode, VisibilityMode, VolumeMode, VolumeUnit,
};
```

becomes:

```rust
use sped_mapping::{
    Action, ActionError, ActionExecutor, ActionOutcome, MuteMode, ObsAction, RecordingMode,
    StartStopToggle, StudioModeMode, VisibilityMode, VolumeMode, VolumeUnit,
};
```

- [ ] **Step 3: Replace the whole `run_action` function body**

Replace the entire function (from `fn run_action(&self, action: ObsAction) -> Result<(), ActionError> {` through its closing `}` before `/// Lists the names of every scene item...`) with:

```rust
    fn run_action(&self, action: ObsAction) -> Result<ActionOutcome, ActionError> {
        let state = self.state.clone();
        self.runtime.block_on(async move {
            let client: Arc<Client> = {
                let guard = state.lock().unwrap();
                guard
                    .client
                    .clone()
                    .ok_or_else(|| ActionError::Failed("OBS is not connected".into()))?
            };

            match action {
                ObsAction::SwitchScene { scene } => {
                    client
                        .scenes()
                        .set_current_program_scene(scene.as_str())
                        .await
                        .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                    Ok(ActionOutcome::with_result(scene))
                }
                ObsAction::Recording { mode } => {
                    let result = match mode {
                        RecordingMode::Start => client.recording().start().await.map(|_| "started"),
                        RecordingMode::Stop => client.recording().stop().await.map(|_| "stopped"),
                        RecordingMode::Pause => client.recording().pause().await.map(|_| "paused"),
                        RecordingMode::Resume => client.recording().resume().await.map(|_| "resumed"),
                        RecordingMode::Toggle => client
                            .recording()
                            .toggle()
                            .await
                            .map(|active| if active { "started" } else { "stopped" }),
                    };
                    result
                        .map(|label| ActionOutcome::with_result(label))
                        .map_err(|e| ActionError::Failed(describe_error(&e)))
                }
                ObsAction::Streaming { mode } => {
                    let result = match mode {
                        StartStopToggle::Start => client.streaming().start().await.map(|_| "started"),
                        StartStopToggle::Stop => client.streaming().stop().await.map(|_| "stopped"),
                        StartStopToggle::Toggle => client
                            .streaming()
                            .toggle()
                            .await
                            .map(|active| if active { "started" } else { "stopped" }),
                    };
                    result
                        .map(|label| ActionOutcome::with_result(label))
                        .map_err(|e| ActionError::Failed(describe_error(&e)))
                }
                ObsAction::VirtualCam { mode } => {
                    let result = match mode {
                        StartStopToggle::Start => client.virtual_cam().start().await.map(|_| "started"),
                        StartStopToggle::Stop => client.virtual_cam().stop().await.map(|_| "stopped"),
                        StartStopToggle::Toggle => client
                            .virtual_cam()
                            .toggle()
                            .await
                            .map(|active| if active { "started" } else { "stopped" }),
                    };
                    result
                        .map(|label| ActionOutcome::with_result(label))
                        .map_err(|e| ActionError::Failed(describe_error(&e)))
                }
                ObsAction::StudioMode { mode } => match mode {
                    StudioModeMode::Enable => client
                        .ui()
                        .set_studio_mode_enabled(true)
                        .await
                        .map(|_| ActionOutcome::with_result("enabled"))
                        .map_err(|e| ActionError::Failed(describe_error(&e))),
                    StudioModeMode::Disable => client
                        .ui()
                        .set_studio_mode_enabled(false)
                        .await
                        .map(|_| ActionOutcome::with_result("disabled"))
                        .map_err(|e| ActionError::Failed(describe_error(&e))),
                    StudioModeMode::Toggle => {
                        let current = client
                            .ui()
                            .studio_mode_enabled()
                            .await
                            .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                        client
                            .ui()
                            .set_studio_mode_enabled(!current)
                            .await
                            .map(|_| ActionOutcome::with_result(if !current { "enabled" } else { "disabled" }))
                            .map_err(|e| ActionError::Failed(describe_error(&e)))
                    }
                    StudioModeMode::TriggerTransition => client
                        .transitions()
                        .trigger()
                        .await
                        .map(|_| ActionOutcome::with_result("triggered"))
                        .map_err(|e| ActionError::Failed(describe_error(&e))),
                },
                ObsAction::SourceMute { source, mode } => {
                    if source.is_empty() {
                        return Err(ActionError::Failed("source not set".into()));
                    }
                    let input = InputId::Name(source.as_str());
                    match mode {
                        MuteMode::Mute => client
                            .inputs()
                            .set_muted(input, true)
                            .await
                            .map(|_| ActionOutcome::with_result("muted"))
                            .map_err(|e| ActionError::Failed(describe_error(&e))),
                        MuteMode::Unmute => client
                            .inputs()
                            .set_muted(input, false)
                            .await
                            .map(|_| ActionOutcome::with_result("unmuted"))
                            .map_err(|e| ActionError::Failed(describe_error(&e))),
                        MuteMode::Toggle => client
                            .inputs()
                            .toggle_mute(input)
                            .await
                            .map(|muted| ActionOutcome::with_result(if muted { "muted" } else { "unmuted" }))
                            .map_err(|e| ActionError::Failed(describe_error(&e))),
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
                        .map(|_| ActionOutcome::with_result(if enabled { "shown" } else { "hidden" }))
                        .map_err(|e| ActionError::Failed(describe_error(&e)))
                }
                ObsAction::SourceVolume { source, mode } => {
                    if source.is_empty() {
                        return Err(ActionError::Failed("source not set".into()));
                    }
                    let input = InputId::Name(source.as_str());
                    let (mul, unit) = match mode {
                        VolumeMode::Absolute { value, unit } => {
                            let mul = match unit {
                                VolumeUnit::Percent => value / 100.0,
                                VolumeUnit::Db => db_to_mul(value),
                            };
                            (mul, unit)
                        }
                        VolumeMode::Relative { value, unit } => {
                            let current = client
                                .inputs()
                                .volume(input)
                                .await
                                .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                            let mul = match unit {
                                VolumeUnit::Percent => current.mul + value / 100.0,
                                VolumeUnit::Db => db_to_mul(current.db + value),
                            }
                            .clamp(0.0, 20.0);
                            (mul, unit)
                        }
                    };
                    client
                        .inputs()
                        .set_volume(input, Volume::Mul(mul))
                        .await
                        .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                    let after = client
                        .inputs()
                        .volume(input)
                        .await
                        .map_err(|e| ActionError::Failed(describe_error(&e)))?;
                    Ok(ActionOutcome::with_result(format_volume(after.mul, after.db, unit)))
                }
            }
        })
    }
```

- [ ] **Step 4: Update the `ActionExecutor` impl's signature**

```rust
impl ActionExecutor for ObsIntegration {
    fn execute(&self, action: &Action) -> Result<(), ActionError> {
```

becomes:

```rust
impl ActionExecutor for ObsIntegration {
    fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError> {
```

(the body, `self.run_action(obs_action.clone())`, stays identical)

- [ ] **Step 5: Add unit tests for the extracted pure helpers**

Append to `crates/integrations/src/obs.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn db_to_mul_matches_known_values() {
        assert!((db_to_mul(0.0) - 1.0).abs() < 1e-6);
        assert!((db_to_mul(-6.0) - 0.501187).abs() < 1e-4);
    }

    #[test]
    fn format_volume_uses_percent_for_percent_unit() {
        assert_eq!(format_volume(0.5, -6.0, VolumeUnit::Percent), "50%");
    }

    #[test]
    fn format_volume_uses_db_for_db_unit() {
        assert_eq!(format_volume(0.5, -6.0, VolumeUnit::Db), "-6.0 dB");
    }
}
```

- [ ] **Step 6: Run the new tests**

Run: `cargo test -p sped-integrations obs::`
Expected: `db_to_mul_matches_known_values`, `format_volume_uses_percent_for_percent_unit`, `format_volume_uses_db_for_db_unit` all pass.

- [ ] **Step 7: Confirm the whole workspace compiles**

Run: `cargo build --workspace`
Expected: succeeds (this closes out the compile errors expected from Tasks 1-3).

- [ ] **Step 8: Commit**

```bash
git add crates/integrations/src/obs.rs
git commit -m "Make ObsIntegration report a human-readable outcome per action"
```

---

## Task 5: `HudCorner`/`HudSettings` (Rust + TypeScript mirror)

**Files:**
- Modify: `src-tauri/src/settings.rs`
- Modify: `src/types.ts`

**Interfaces:**
- Produces (Rust): `pub enum HudCorner { TopLeft, TopRight, BottomRight, BottomLeft }` (default `BottomRight`, `#[serde(rename_all = "camelCase")]`); `pub struct HudSettings { pub enabled: bool, pub position: HudCorner }` (default `enabled: false`); `ExperienceSettings.hud: HudSettings`.
- Produces (TypeScript): `export type HudCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";`, `export interface HudSettings { enabled: boolean; position: HudCorner; }`, `ExperienceSettings.hud: HudSettings`.

- [ ] **Step 1: Add `HudCorner`/`HudSettings` to `settings.rs`**

In `src-tauri/src/settings.rs`, immediately after the `LedFeedbackSettings` struct, add:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum HudCorner {
    TopLeft,
    TopRight,
    #[default]
    BottomRight,
    BottomLeft,
}

/// The action HUD: a click-through, always-on-top, capture-excluded toast
/// stack that shows which control fired and what happened. See
/// `docs/superpowers/specs/2026-09-17-hud-overlay-design.md`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HudSettings {
    pub enabled: bool,
    #[serde(default)]
    pub position: HudCorner,
}
```

- [ ] **Step 2: Add the field to `ExperienceSettings`**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExperienceSettings {
    #[serde(default)]
    pub language: Language,
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub led_feedback: LedFeedbackSettings,
}
```

becomes:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExperienceSettings {
    #[serde(default)]
    pub language: Language,
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub led_feedback: LedFeedbackSettings,
    #[serde(default)]
    pub hud: HudSettings,
}
```

- [ ] **Step 3: Mirror both types in `src/types.ts`**

Immediately after the `LedFeedbackSettings` interface, add:

```ts
export type HudCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

export interface HudSettings {
  enabled: boolean;
  position: HudCorner;
}
```

Then update `ExperienceSettings`:

```ts
export interface ExperienceSettings {
  language: Language;
  theme: Theme;
  ledFeedback: LedFeedbackSettings;
}
```

becomes:

```ts
export interface ExperienceSettings {
  language: Language;
  theme: Theme;
  ledFeedback: LedFeedbackSettings;
  hud: HudSettings;
}
```

- [ ] **Step 4: Confirm the Rust side compiles and its settings round-trip test still passes**

Run: `cargo check -p speed-editor-control-lib`
Expected: succeeds.

- [ ] **Step 5: Confirm the TypeScript side type-checks**

Run: `npx tsc --noEmit`
Expected: fails at this point — `ExperienceSettings.hud` is required but nothing constructs it yet outside of what `AppSettings` comes from the backend. This is expected; re-run after Task 13 wires the Settings UI. If it fails anywhere *other than* a missing-`hud`-property complaint in a settings-construction site, treat that as a real bug and stop to investigate.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/settings.rs src/types.ts
git commit -m "Add HUD enabled/position settings"
```

---

## Task 6: `windows` crate dependency + `hud_window.rs` (window lifecycle, capture exclusion, event struct)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/hud_window.rs`

**Interfaces:**
- Consumes: `crate::settings::HudCorner` (Task 5); `sped_device::ControlId`; `sped_mapping::Action`.
- Produces: `pub const HUD_WINDOW_LABEL: &str = "hud";`, `pub struct HudEvent { pub control: ControlId, pub action: Action, pub ok: bool, pub result: Option<String> }` (Serialize, camelCase), `pub fn emit(app: &AppHandle, control: ControlId, action: &Action, ok: bool, result: Option<String>)`, `pub fn open(app: &AppHandle, corner: HudCorner)`, `pub fn close(app: &AppHandle)` — all consumed by Task 7 (`device_manager.rs`) and Task 8 (`lib.rs`/`commands.rs`).

- [ ] **Step 1: Add the `windows` crate dependency, pinned to the version `tauri` itself uses**

In `src-tauri/Cargo.toml`, add a new section (anywhere after `[dependencies]`):

```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.61", features = ["Win32_Foundation", "Win32_UI_WindowsAndMessaging"] }
```

- [ ] **Step 2: Create `src-tauri/src/hud_window.rs`**

```rust
//! HUD overlay window: a small, click-through, always-on-top toast stack
//! that shows which action just fired and its result, excluded from
//! screen-capture software (`SetWindowDisplayAffinity`/
//! `WDA_EXCLUDEFROMCAPTURE`) so it never leaks into a recording. See
//! `docs/superpowers/specs/2026-09-17-hud-overlay-design.md`.

use crate::settings::HudCorner;
use serde::Serialize;
use sped_device::ControlId;
use sped_mapping::Action;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};

pub const HUD_WINDOW_LABEL: &str = "hud";
const HUD_WIDTH: f64 = 360.0;
const HUD_HEIGHT: f64 = 480.0;
const HUD_MARGIN: f64 = 16.0;

/// Payload for the `"hud-event"` event emitted to the `hud` window every
/// time a mapped control resolves to an action. `result` is the
/// executor's human-readable outcome (`ActionOutcome::result`) on
/// success, or the failure message on error -- `None` only for actions
/// with nothing meaningful to report (e.g. keyboard shortcuts).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HudEvent {
    pub control: ControlId,
    pub action: Action,
    pub ok: bool,
    pub result: Option<String>,
}

/// Emits an `hud-event` to the HUD window. Callers already gate on
/// `settings.experience.hud.enabled` before calling this; if the window
/// was closed in the gap between that check and this call, this just logs
/// a warning rather than panicking.
pub fn emit(app: &AppHandle, control: ControlId, action: &Action, ok: bool, result: Option<String>) {
    let event = HudEvent { control, action: action.clone(), ok, result };
    if let Err(err) = app.emit_to(HUD_WINDOW_LABEL, "hud-event", &event) {
        tracing::warn!(?err, "failed to emit hud-event");
    }
}

/// Creates the HUD overlay window: transparent, click-through,
/// always-on-top, excluded from screen capture, anchored to `corner` on
/// the primary monitor. No-op if the window is already open -- callers
/// that need to move it (a settings change) call [`close`] first.
pub fn open(app: &AppHandle, corner: HudCorner) {
    if app.get_webview_window(HUD_WINDOW_LABEL).is_some() {
        return;
    }

    let window = match WebviewWindowBuilder::new(app, HUD_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("HUD")
        .inner_size(HUD_WIDTH, HUD_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .focused(false)
        .build()
    {
        Ok(window) => window,
        Err(err) => {
            tracing::warn!(?err, "failed to create HUD window");
            return;
        }
    };

    if let Err(err) = window.set_position(position_for(&window, corner)) {
        tracing::warn!(?err, "failed to position HUD window");
    }
    if let Err(err) = window.set_ignore_cursor_events(true) {
        tracing::warn!(?err, "failed to make HUD window click-through");
    }

    exclude_from_capture(&window);
}

/// Destroys the HUD window if it's open. No-op otherwise.
pub fn close(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(HUD_WINDOW_LABEL) {
        let _ = window.destroy();
    }
}

fn position_for(window: &WebviewWindow, corner: HudCorner) -> PhysicalPosition<i32> {
    let work_area = window
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| *monitor.work_area())
        .unwrap_or_default();

    let left = work_area.position.x as f64;
    let top = work_area.position.y as f64;
    let right = left + work_area.size.width as f64;
    let bottom = top + work_area.size.height as f64;

    let (x, y) = match corner {
        HudCorner::TopLeft => (left + HUD_MARGIN, top + HUD_MARGIN),
        HudCorner::TopRight => (right - HUD_WIDTH - HUD_MARGIN, top + HUD_MARGIN),
        HudCorner::BottomLeft => (left + HUD_MARGIN, bottom - HUD_HEIGHT - HUD_MARGIN),
        HudCorner::BottomRight => (right - HUD_WIDTH - HUD_MARGIN, bottom - HUD_HEIGHT - HUD_MARGIN),
    };

    PhysicalPosition::new(x as i32, y as i32)
}

/// Excludes `window` from screen/window capture (OBS, Windows Graphics
/// Capture, etc.) via `SetWindowDisplayAffinity`. Requires Windows 10
/// 2004+ -- on older Windows this fails and is logged, and the HUD simply
/// stays capturable rather than refusing to open.
fn exclude_from_capture(window: &WebviewWindow) {
    let hwnd: HWND = match window.hwnd() {
        Ok(hwnd) => hwnd,
        Err(err) => {
            tracing::warn!(?err, "failed to get HUD window handle");
            return;
        }
    };

    // SAFETY: `hwnd` was just obtained from the HUD window above and is
    // valid for the duration of this call.
    if let Err(err) = unsafe { SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) } {
        tracing::warn!(
            ?err,
            "failed to exclude HUD window from screen capture (requires Windows 10 2004+)"
        );
    }
}
```

- [ ] **Step 3: Register the module in `lib.rs`**

In `src-tauri/src/lib.rs`, change:

```rust
mod commands;
mod device_manager;
mod settings;
mod state;
mod window_chrome;
```

to:

```rust
mod commands;
mod device_manager;
mod hud_window;
mod settings;
mod state;
mod window_chrome;
```

- [ ] **Step 4: Confirm it compiles**

Run: `cargo check -p speed-editor-control-lib`
Expected: succeeds. `hud_window::emit`/`open`/`close` are unused at this point (nothing calls them yet) — expect and ignore `dead_code` warnings; they're resolved once Tasks 7-8 wire them in.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/hud_window.rs src-tauri/src/lib.rs
git commit -m "Add the HUD overlay window: lifecycle, positioning, capture exclusion"
```

---

## Task 7: Wire the device thread to emit `hud-event` per action

**Files:**
- Modify: `src-tauri/src/device_manager.rs`

**Interfaces:**
- Consumes: `hud_window::emit` (Task 6), `Dispatcher::execute` (Task 1, now per-action instead of `execute_all`).
- Produces: nothing new consumed elsewhere — this is the leaf that turns dispatched actions into HUD events.

- [ ] **Step 1: Add the needed imports**

```rust
use crate::settings::AppSettings;
use crate::state::AppState;
use sped_device::{mock_surface, ControlEvent, ControlId, ControlSurface, SpeedEditorSurface};
use std::sync::mpsc;
use std::thread;
use sped_mapping::ActionError;
use tauri::{AppHandle, Emitter, Manager};

use crate::hud_window;
```

(`ControlId` added to the existing `sped_device` import; `ActionError` and `crate::hud_window` are new lines.)

- [ ] **Step 2: Add the control-resolution helper**

Add this function near the bottom of the file (after `apply_jog_settings`, before `spawn`):

```rust
/// Maps a device event to the `ControlId` the HUD should attribute its
/// resulting actions to. `None` for events that never carry mapped
/// actions (`Connected`/`Disconnected`, and `Shuttle` which
/// `MappingEngine::resolve_jog` never resolves to anything -- see its own
/// doc comment).
fn hud_control_for(event: &ControlEvent) -> Option<ControlId> {
    match event {
        ControlEvent::Pressed { control } | ControlEvent::Released { control } => Some(*control),
        ControlEvent::Jog { .. } => Some(ControlId::JogWheel),
        _ => None,
    }
}
```

- [ ] **Step 3: Replace the action-execution block inside the processor loop**

Replace:

```rust
                    if keep {
                        let actions = state.engine.lock().unwrap().handle_event(&event);
                        if !actions.is_empty() {
                            if let Err(err) = state.dispatcher.execute_all(&actions) {
                                tracing::warn!(?err, ?event, "action execution failed");
                            }
                        }
                    }
```

with:

```rust
                    if keep {
                        let actions = state.engine.lock().unwrap().handle_event(&event);
                        if !actions.is_empty() {
                            let hud_control = hud_control_for(&event);
                            let hud_enabled =
                                hud_control.is_some() && state.settings.get().experience.hud.enabled;

                            for action in &actions {
                                match state.dispatcher.execute(action) {
                                    Ok(outcome) => {
                                        if hud_enabled {
                                            hud_window::emit(
                                                &processor_app,
                                                hud_control.unwrap(),
                                                action,
                                                true,
                                                outcome.result,
                                            );
                                        }
                                    }
                                    Err(ActionError::Unsupported) => {
                                        tracing::warn!(?event, ?action, "no executor claimed action");
                                    }
                                    Err(ActionError::Failed(message)) => {
                                        tracing::warn!(%message, ?event, "action execution failed");
                                        if hud_enabled {
                                            hud_window::emit(
                                                &processor_app,
                                                hud_control.unwrap(),
                                                action,
                                                false,
                                                Some(message),
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
```

- [ ] **Step 4: Confirm it compiles**

Run: `cargo check -p speed-editor-control-lib`
Expected: succeeds, and `hud_window::emit` is no longer reported dead.

- [ ] **Step 5: Manual smoke test with the mock device**

Run: `SPED_MOCK=1 cargo tauri dev` (or `pnpm tauri dev` with `SPED_MOCK=1` set beforehand, matching however this project's existing mock workflow is normally started — check `README.md` if unsure).
Trigger a mapped control via the Dev Panel's mock send and confirm the app still runs without panics (the HUD window doesn't exist yet — `hud_enabled` will always be `false` at this point since Task 13 hasn't added a way to turn it on — this step is only confirming the new per-action loop doesn't regress existing action execution).
Expected: no panics, existing action execution (e.g. a keyboard shortcut mapping) still fires normally.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/device_manager.rs
git commit -m "Emit an hud-event per dispatched action from the device thread"
```

---

## Task 8: Open/close the HUD window from startup and from settings changes

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: `hud_window::open`/`close` (Task 6).

- [ ] **Step 1: Give the main window an explicit label**

In `src-tauri/tauri.conf.json`, the single entry under `app.windows` gains a `"label"` key (Tauri defaults an unlabeled first window to `"main"` already, but `hud_window.rs` and `main.tsx` both compare against the literal string `"main"`, so make it explicit rather than relying on the default):

```json
    "windows": [
      {
        "label": "main",
        "title": "Speed Editor Control",
```

(only the new `"label"` line is added; every other key stays as-is)

- [ ] **Step 2: Open the HUD window at startup if it was left enabled**

In `src-tauri/src/lib.rs`, inside `.setup(|app| { ... })`, change:

```rust
            let settings = state.settings.get();
            if settings.obs.autoconnect {
                let password = settings::get_obs_password();
                state.obs.connect(settings.obs.host, settings.obs.port, password);
            }

            app.manage(state);
```

to:

```rust
            let settings = state.settings.get();
            if settings.obs.autoconnect {
                let password = settings::get_obs_password();
                state.obs.connect(settings.obs.host, settings.obs.port, password);
            }
            if settings.experience.hud.enabled {
                hud_window::open(app.handle(), settings.experience.hud.position);
            }

            app.manage(state);
```

- [ ] **Step 3: Toggle the HUD window when settings are saved**

In `src-tauri/src/commands.rs`, change:

```rust
#[tauri::command]
pub fn set_settings(state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    state.settings.update(settings)
}
```

to:

```rust
#[tauri::command]
pub fn set_settings(app: tauri::AppHandle, state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    state.settings.update(settings.clone())?;
    // Always close first: the position may have changed while already
    // enabled, and `hud_window::open` is a no-op if the window still
    // exists, so a plain "open if enabled" wouldn't pick up a moved
    // corner.
    crate::hud_window::close(&app);
    if settings.experience.hud.enabled {
        crate::hud_window::open(&app, settings.experience.hud.position);
    }
    Ok(())
}
```

- [ ] **Step 4: Confirm it compiles**

Run: `cargo build --workspace`
Expected: succeeds.

- [ ] **Step 5: Manual verification**

Run the app normally (`pnpm tauri dev` or the project's usual dev command). Nothing user-visible has changed yet (no UI exposes the HUD toggle until Task 13), so this step just confirms the app still starts and settings still save without error — open Settings, change any existing toggle (e.g. theme), confirm it applies as before.
Expected: app starts, existing settings still save and apply correctly, no new errors in the console.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/commands.rs src-tauri/tauri.conf.json
git commit -m "Open/close the HUD window on startup and on settings changes"
```

---

## Task 9: `HudEvent` TypeScript type + `onHudEvent` listener

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`

**Interfaces:**
- Produces: `export interface HudEvent { control: ControlId; action: Action; ok: boolean; result: string | null; }`; `export function onHudEvent(handler: (event: HudEvent) => void): Promise<UnlistenFn>`.

- [ ] **Step 1: Add `HudEvent` to `types.ts`**

Immediately after the `ObsAction` type union (after `export type Action = KeyboardAction | ObsAction;`), add:

```ts
export interface HudEvent {
  control: ControlId;
  action: Action;
  ok: boolean;
  result: string | null;
}
```

- [ ] **Step 2: Add `onHudEvent` to `api.ts`**

Add `HudEvent` to the type-only import at the top:

```ts
import type {
  AppSettings,
  ControlEvent,
  DeviceStatus,
  LedId,
  Mapping,
  MockCommand,
  ObsStatus,
  Profile,
} from "./types";
```

becomes:

```ts
import type {
  AppSettings,
  ControlEvent,
  DeviceStatus,
  HudEvent,
  LedId,
  Mapping,
  MockCommand,
  ObsStatus,
  Profile,
} from "./types";
```

Add the listener function at the bottom of the file, next to `onDeviceEvent`:

```ts
export function onHudEvent(handler: (event: HudEvent) => void): Promise<UnlistenFn> {
  return listen<HudEvent>("hud-event", (e) => handler(e.payload));
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this task (the pre-existing `hud` property error from Task 5 is still expected until Task 13).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/api.ts
git commit -m "Add the HudEvent type and onHudEvent listener"
```

---

## Task 10: Plain-text control labels for the HUD

**Files:**
- Create: `src/hud/controlLabels.ts`

**Interfaces:**
- Produces: `export function controlLabel(id: ControlId): string`.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/hud
```

Create `src/hud/controlLabels.ts`:

```ts
import type { ControlId } from "../types";

/** Plain-text HUD labels for every physical control, matching the
 * abbreviated silkscreen labels `SpeedEditor.tsx` renders as JSX --
 * duplicated here as plain strings since the HUD is a separate
 * window/document and can't reuse `ReactNode` labels meant for the main
 * grid layout. */
const CONTROL_LABELS: Record<string, string> = {
  "smart-insert": "SMART INSRT",
  append: "APPND CLIP",
  "ripple-owr": "RIPL O/WR",
  "close-up": "CLOSE UP YPOS",
  "place-top": "PLACE ON TOP CLIP",
  "source-owr": "SRC O/WR",
  in: "IN CLR",
  out: "OUT CLR",
  "trim-in": "TRIM IN",
  "trim-out": "TRIM OUT",
  roll: "ROLL SLIDE",
  "slip-src": "SLIP SRC",
  "slip-dest": "SLIP DEST",
  "trans-dur": "TRANS DUR SET",
  cut: "CUT",
  dis: "DIS",
  "smth-cut": "SMTH CUT",
  esc: "ESC UNDO",
  "sync-bin": "SYNC BIN",
  "audio-level": "AUDIO LEVEL MARK",
  "full-view": "FULL VIEW RVW",
  "trans-title": "TRANS TITLE",
  "split-move": "SPLIT MOVE",
  snap: "SNAP",
  "ripple-delete": "RIPL DEL",
  "cam-1": "CAM 1",
  "cam-2": "CAM 2",
  "cam-3": "CAM 3",
  "cam-4": "CAM 4",
  "cam-5": "CAM 5",
  "cam-6": "CAM 6",
  "cam-7": "CAM 7",
  "cam-8": "CAM 8",
  "cam-9": "CAM 9",
  "live-owr": "LIVE O/WR",
  "video-only": "VIDEO ONLY RND",
  "audio-only": "AUDIO ONLY",
  "stop-play": "STOP / PLAY",
  source: "SOURCE",
  timeline: "TIMELINE",
  shuttle: "SHTL",
  jog: "JOG",
  scroll: "SCRL",
  "jog-wheel": "JOG WHEEL",
};

/** Falls back to the raw id (uppercased) for any control not in the map,
 * so an unrecognized id still renders something instead of `undefined`. */
export function controlLabel(id: ControlId): string {
  return CONTROL_LABELS[id] ?? id.toUpperCase();
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hud/controlLabels.ts
git commit -m "Add plain-text HUD control labels"
```

---

## Task 11: `HudOverlay` component

**Files:**
- Create: `src/hud/HudOverlay.tsx`

**Interfaces:**
- Consumes: `onHudEvent` (Task 9), `controlLabel` (Task 10), `actionLabel` (existing, `src/types.ts`), `useTheme` (existing, `src/cscl-ui/lib/hooks/useTheme.ts`), `api.getSettings` (existing).
- Produces: `export function HudOverlay()`, mounted by Task 12.

- [ ] **Step 1: Create `src/hud/HudOverlay.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { api, onHudEvent } from "../api";
import { useTheme } from "../cscl-ui/lib/hooks/useTheme";
import { cn } from "../cscl-ui/lib/cn";
import { actionLabel, type Action, type ControlId, type HudCorner } from "../types";
import { controlLabel } from "./controlLabels";

const DISMISS_MS = 1800;
const MAX_TOASTS = 4;

interface Toast {
  id: number;
  key: string;
  control: ControlId;
  action: Action;
  ok: boolean;
  result: string | null;
  timeoutId: ReturnType<typeof setTimeout>;
}

/** Groups events so a rapidly-firing `JogContinuous` mapping updates one
 * toast in place instead of spawning a new one per wheel tick. */
function coalesceKey(control: ControlId, action: Action): string {
  if (action.kind === "keyboard") return `${control}|keyboard`;
  const source = "source" in action ? action.source : "";
  return `${control}|${action.op}|${source}`;
}

let nextToastId = 0;

export function HudOverlay() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  const [corner, setCorner] = useState<HudCorner>("bottomRight");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  toastsRef.current = toasts;

  useTheme(theme);

  useEffect(() => {
    // A separate window/document from the main app -- theme.css's `body`
    // background must be cleared here so the OS-level transparent window
    // actually shows through instead of an opaque `--color-bg` square.
    document.body.style.backgroundColor = "transparent";

    api.getSettings().then((settings) => {
      setTheme(settings.experience.theme);
      setCorner(settings.experience.hud.position);
    });
  }, []);

  useEffect(() => {
    function dismiss(id: number) {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }

    const unlisten = onHudEvent((event) => {
      const key = coalesceKey(event.control, event.action);
      const existing = toastsRef.current.find((t) => t.key === key);

      if (existing) {
        clearTimeout(existing.timeoutId);
        const timeoutId = setTimeout(() => dismiss(existing.id), DISMISS_MS);
        setToasts((prev) =>
          prev.map((t) =>
            t.id === existing.id ? { ...t, ok: event.ok, result: event.result, timeoutId } : t,
          ),
        );
        return;
      }

      const id = nextToastId++;
      const timeoutId = setTimeout(() => dismiss(id), DISMISS_MS);
      setToasts((prev) =>
        [
          ...prev,
          {
            id,
            key,
            control: event.control,
            action: event.action,
            ok: event.ok,
            result: event.result,
            timeoutId,
          },
        ].slice(-MAX_TOASTS),
      );
    });

    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  const isTop = corner === "topLeft" || corner === "topRight";
  const isLeft = corner === "topLeft" || corner === "bottomLeft";
  // Whichever corner the window is anchored to, the newest toast should
  // end up closest to it -- for top corners that means rendering newest
  // first (the group is packed against the top), for bottom corners the
  // natural oldest-first order already puts the newest at the bottom.
  const ordered = isTop ? [...toasts].reverse() : toasts;

  return (
    <div
      className={cn(
        "flex h-screen w-screen flex-col gap-2 p-4",
        isTop ? "justify-start" : "justify-end",
        isLeft ? "items-start" : "items-end",
      )}
    >
      {ordered.map((toast) => (
        <div
          key={toast.id}
          className="w-full max-w-[320px] rounded-lg border border-border bg-surface-raised p-3 shadow-float"
        >
          <div className="text-xs font-semibold text-text">{controlLabel(toast.control)}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">{actionLabel(toast.action)}</div>
          {toast.result && (
            <div className={cn("mt-0.5 text-[11px]", toast.ok ? "text-text-muted" : "text-danger")}>
              {toast.result}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file (the pre-existing `hud` settings-construction error from Task 5 is still expected until Task 13).

- [ ] **Step 3: Commit**

```bash
git add src/hud/HudOverlay.tsx
git commit -m "Add the HudOverlay toast-stack component"
```

---

## Task 12: Mount `HudOverlay` in the `hud` window

**Files:**
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `HudOverlay` (Task 11), `@tauri-apps/api/window`'s `getCurrentWindow`.

- [ ] **Step 1: Branch on the window label**

Replace `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { HudOverlay } from "./hud/HudOverlay";
import "./theme.css";

// Same SPA bundle backs both windows -- branching here (before any hooks
// run) rather than inside `App` avoids a component that sometimes returns
// early before calling its own hooks.
const isHud = getCurrentWindow().label === "hud";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isHud ? <HudOverlay /> : <App />}</React.StrictMode>,
);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "Mount HudOverlay in the hud window instead of the main app"
```

---

## Task 13: Settings UI — HUD toggle and corner picker

**Files:**
- Modify: `src/components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `settings.experience.hud` (Task 5), the existing `patch`/`Switch`/`SegmentedControl` pattern already used for `ledFeedback`/`theme`.

- [ ] **Step 1: Add the HUD toggle + corner picker to the Experience tab**

In `src/components/SettingsModal.tsx`, inside the `{tab === "experience" && (...)}` block, immediately after the closing `</div>` of the `ledFeedback` block (i.e. right before the final `</div>` that closes the whole `experience` tab's `flex flex-col gap-4` container), add:

```tsx
          <div>
            <SidebarTabsDialogRow label="Show action HUD">
              <Switch
                checked={settings.experience.hud.enabled}
                label="Show action HUD"
                onChange={(enabled) =>
                  patch({
                    ...settings,
                    experience: {
                      ...settings.experience,
                      hud: { ...settings.experience.hud, enabled },
                    },
                  })
                }
              />
            </SidebarTabsDialogRow>
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
              Shows a small toast for every control press that fires an action -- which control,
              what it did, and the result. Excluded from screen recordings and capture.
            </p>

            {settings.experience.hud.enabled && (
              <div className="mt-3 border-l-2 border-border pl-3">
                <SidebarTabsDialogRow label="Position">
                  <SegmentedControl
                    value={settings.experience.hud.position}
                    options={[
                      { value: "topLeft", label: "Top Left" },
                      { value: "topRight", label: "Top Right" },
                      { value: "bottomLeft", label: "Bottom Left" },
                      { value: "bottomRight", label: "Bottom Right" },
                    ]}
                    onChange={(position) =>
                      patch({
                        ...settings,
                        experience: {
                          ...settings.experience,
                          hud: { ...settings.experience.hud, position },
                        },
                      })
                    }
                  />
                </SidebarTabsDialogRow>
              </div>
            )}
          </div>
```

- [ ] **Step 2: Type-check the whole frontend**

Run: `npx tsc --noEmit`
Expected: succeeds with no errors at all now (this closes out the `ExperienceSettings.hud` errors expected since Task 5 — `SettingsModal` was the only place that constructs/patches `ExperienceSettings` without already having a `hud` value flow through it end-to-end from the backend).

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "Add HUD enable/position controls to Experience settings"
```

---

## Task 14: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build and run with the mock device**

Run: `cargo build --workspace` then start the app in dev mode with `SPED_MOCK=1` set (per this project's existing mock-mode workflow, already used by `device_manager::spawn`).
Expected: app starts normally.

- [ ] **Step 2: Enable the HUD**

Open Settings → Experience → toggle "Show action HUD" on, leave position at the default (Bottom Right).
Expected: a small borderless window appears anchored to the bottom-right of the primary monitor's work area; it does not steal focus from the main window.

- [ ] **Step 3: Trigger a keyboard-mapped control**

Via the Dev Panel's mock control send (or a real device if attached), fire a control mapped to a `Keyboard` action.
Expected: a toast appears in the HUD showing the control's label and the key combo, with no third (result) line, and disappears after ~1.8s.

- [ ] **Step 4: Trigger an OBS-mapped control (requires a running OBS with obs-websocket enabled)**

Connect to OBS from Settings → OBS Studio. Map a control to `Source Volume` (either unit) on a real input, and to `Source Mute` toggle, then fire both.
Expected: each shows a three-line toast — control, action description, and a result line (e.g. `-4.0 dB` or `62%` for volume; `muted`/`unmuted` for mute) — matching what OBS's own mixer shows for that input afterward.

- [ ] **Step 5: Confirm jog-wheel coalescing**

Map `JogContinuous` on the jog wheel to a relative `Source Volume` action, then spin the wheel continuously for a couple of seconds.
Expected: only one toast is visible at a time for that control/action, its result line updating live rather than a stack of near-identical toasts piling up.

- [ ] **Step 6: Confirm capture exclusion**

In OBS, add a Window Capture or Display Capture source covering the area where the HUD appears, and start a recording (or just watch the live preview). Trigger a mapped control so a HUD toast appears on-screen.
Expected: the toast is visible to the naked eye on the monitor but does **not** appear in the OBS source preview/recording.

- [ ] **Step 7: Confirm toggling off closes the window immediately**

With a toast currently visible, open Settings → Experience and toggle "Show action HUD" off.
Expected: the HUD window closes immediately, not waiting for the visible toast's dismiss timer.

- [ ] **Step 8: Run the full automated suite one more time before wrapping up**

Run: `cargo test --workspace && npx tsc --noEmit`
Expected: all pass, no type errors.
