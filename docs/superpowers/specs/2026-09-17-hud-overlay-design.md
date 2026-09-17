# HUD overlay — design

## Goal

Give the user live, on-screen feedback for every control press that
resolves to an action ("TRIM-IN pressed → OBS Source Volume (Voix) +2dB →
volume: -4dB on OBS"), as a small toast stack that appears over whatever
they're doing. It must be genuinely invisible to screen-capture software
(OBS Window/Display Capture, Windows Graphics Capture) since the whole
point is to check what fired *while* recording/streaming without it
polluting the recording. Toggled from Experience settings; off by default.

Windows is this app's real target (per `window_chrome.rs`'s own note), so
the capture-exclusion mechanism is allowed to be Windows-only.

## Data flow

A new `ActionOutcome` return value threads from executor through the
dispatcher up to the device thread, which emits it to a dedicated `hud`
window as a `hud-event`:

```
device thread (device_manager.rs)
  engine.handle_event(event) -> Vec<Action>
  for each action:
    dispatcher.execute(action) -> Result<ActionOutcome, ActionError>
    app.emit_to("hud", "hud-event", HudEvent { control, action, outcome })
```

`HudEvent` carries the raw `ControlId` and `Action` (not a pre-formatted
string) so the HUD frontend can reuse the *same* `actionLabel()` helper
`PropertiesPanel` already uses — zero duplicated formatting logic between
the sidebar and the HUD.

### `ActionExecutor` signature change

`crates/mapping/src/executor.rs`:

```rust
pub struct ActionOutcome {
    /// Human-readable resulting state, e.g. "-4 dB", "muted", "Scene 2".
    /// `None` for actions with nothing meaningful to report (keyboard).
    pub result: Option<String>,
}

impl ActionOutcome {
    pub fn none() -> Self { Self { result: None } }
    pub fn with_result(result: impl Into<String>) -> Self { ... }
}

pub trait ActionExecutor: Send + Sync {
    fn execute(&self, action: &Action) -> Result<ActionOutcome, ActionError>;
}
```

- `sped-integrations::keyboard`'s executor returns `ActionOutcome::none()`
  on success — there's no device-side state to read back.
- `sped-integrations::obs`'s executor returns a formatted result per
  variant after applying the action:
  - `SourceVolume`: reads back the input's volume post-set and formats it
    in *the action's own unit* (`VolumeUnit::Percent` → `"62%"`,
    `VolumeUnit::Db` → `"-4 dB"`, using the existing `mul_to_db` helper).
  - `SourceMute`: `"muted"` / `"unmuted"`.
  - `SourceVisibility`: `"shown"` / `"hidden"`.
  - `SwitchScene`: the scene name.
  - `Recording` / `Streaming` / `VirtualCam` / `StudioMode`: the resulting
    state word (`"started"`, `"stopped"`, etc.) where cheaply available;
    `ActionOutcome::none()` otherwise rather than making an extra round
    trip to OBS just for the toast.
- `Dispatcher::execute`/`execute_all` propagate `ActionOutcome` through
  unchanged (`execute_all` still stops at the first error; it isn't
  responsible for HUD emission, the device thread is).

### Device thread wiring

`device_manager.rs`'s processor loop currently does:

```rust
if let Err(err) = state.dispatcher.execute_all(&actions) {
    tracing::warn!(?err, ?event, "action execution failed");
}
```

This becomes a per-action loop (needed anyway once outcomes must be
attached to their own action) that, for each action, calls
`state.dispatcher.execute(action)` and emits an `hud-event` to the `"hud"`
window with the control, the action, and either the `Ok(outcome)` or the
`Err` (rendered as a failure toast) — gated on
`state.settings.get().experience.hud.enabled` so nothing is emitted (or
the window doesn't exist) when the feature is off. `execute_all`'s
stop-on-first-error semantics for actual execution are preserved; only
the HUD side observes every attempted action.

## HUD window

- New Tauri window, label `"hud"`, created in `lib.rs`'s `setup()` only
  when `settings.experience.hud.enabled` is true, and created/destroyed
  on the fly by the `set_settings` command when the setting flips (no app
  restart required).
- Built via `WebviewWindowBuilder`: `transparent(true)`,
  `decorations(false)`, `always_on_top(true)`, `skip_taskbar(true)`,
  `shadow(false)`, `resizable(false)`, `focused(false)`. Fixed size
  (360×480), anchored to the configured corner of the **primary**
  monitor's work area, computed once at creation.
- Click-through: `window.set_ignore_cursor_events(true)` immediately after
  creation so it never intercepts clicks or steals focus.
- Capture exclusion: new `src-tauri/src/hud_window.rs`. Pulls the raw
  `HWND` from `window.hwnd()` and calls
  `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` via the
  `windows` crate (new dependency: `Win32_UI_WindowsAndMessaging` +
  `Win32_Foundation` features). Runs once right after the window is
  shown. Failure (pre-Windows-10-2004) is logged as a warning and
  swallowed — the HUD still functions, just becomes capturable, rather
  than failing to launch.
- No router added. `App.tsx`'s root checks
  `getCurrentWindow().label` (`@tauri-apps/api/window`): `"main"` renders
  the existing app tree, `"hud"` renders a new `HudOverlay` component.
  Same bundle, same `theme.css` tokens, so the HUD matches the active
  theme automatically.
- Independent lifecycle from the main window: minimizing/backgrounding
  `"main"` has no effect on `"hud"` — it's meant to still work while the
  user is tabbed into OBS.

## HUD frontend (`HudOverlay`)

- Subscribes to `"hud-event"`; keeps a local array of toasts:
  `{ id, controlLabel, actionLabel, result, ok, createdAt }`.
- Card layout, reusing `cscl-ui` primitives:
  - header: `"{controlLabel} pressed"`
  - action line: `actionLabel(action)` (same formatter as the sidebar)
  - result line: `outcome.result` if present, styled as an error accent
    when `ok: false` (dispatch/executor failure); omitted entirely when
    `result` is `None` (e.g. keyboard actions).
- New toasts enter the stack closest to the configured corner (matching
  common toast-notification convention), each auto-dismissing after
  ~1.8s on its own timer, with a short fade/slide transition in and out.
- Stack cap: 4 visible toasts; anything beyond that is dropped
  immediately rather than queued, so a burst can't pile up.
- **Jog-continuous coalescing**: `JogContinuous` mappings fire once per
  wheel tick. Rather than spawning a toast per tick, `HudOverlay`
  recognizes consecutive `hud-event`s sharing `(control, action.op,
  action.source)` within ~400ms of each other and updates the existing
  top toast's result + resets its dismiss timer instead of pushing a new
  one. Purely a frontend debounce; no backend change.

## Settings

Lives in `src-tauri/src/settings.rs` (`ExperienceSettings`, alongside
`LedFeedbackSettings`):

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum HudCorner {
    TopLeft,
    TopRight,
    #[default]
    BottomRight,
    BottomLeft,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HudSettings {
    pub enabled: bool,     // default false
    #[serde(default)]
    pub position: HudCorner,
}
```

Added to `ExperienceSettings` as `pub hud: HudSettings` with
`#[serde(default)]`, so existing `settings.json` files load unaffected.
Mirrored in `src/types.ts`. `SettingsModal`'s Experience tab gets a new
toggle ("Show action HUD") plus a corner picker shown only while enabled,
following the existing `patch({...settings, experience: {...}})` pattern
used for `ledFeedback`.

## Error handling & edge cases

- `SetWindowDisplayAffinity` failure: warn + continue, HUD still works
  but becomes screen-capturable.
- Toggling the HUD off destroys the window immediately — no waiting out
  in-flight toast timers.
- Dispatcher `Err(ActionError::Failed)` still produces an `hud-event`
  (`ok: false`) so failed OBS calls are visible in the HUD, not just in
  logs.
- `ActionError::Unsupported` (nothing claimed the action — shouldn't
  normally happen once actions are configured) is not surfaced as a HUD
  failure toast; it's a mapping/config bug, not something the user acted
  on, and stays a `tracing::warn!` like today.
- Multi-monitor: v1 always anchors to the **primary** monitor's work
  area. No per-monitor picker.

## Testing

- Rust unit tests: each `ActionOutcome`-returning executor path
  (keyboard → `none()`; each `ObsAction` variant → its formatted result
  string, including both `VolumeUnit` cases for `SourceVolume`).
- Manual verification: run with `SPED_MOCK=1`, trigger a few mapped
  controls via the Dev Panel, confirm toasts render, confirm consecutive
  jog-continuous events coalesce instead of stacking, and confirm — with
  an actual OBS Window/Display Capture source pointed at the screen —
  that the HUD window is excluded from the captured frame while still
  visible live.
