# OBS grouped, configurable actions — design

## Goal

Expand the OBS action surface to the practical maximum `obws` (0.15) exposes,
without exploding the sidebar into one draggable item per operation. Instead,
each OBS "family" (Recording, Streaming, Virtual Camera, Studio Mode, Source
Mute, Source Visibility, Source Volume) is a single draggable action with a
`mode`, defaulting to something sane on drop and fully editable afterwards in
the Properties Panel — no re-dragging required to reconfigure.

`switch_scene` is unaffected: picking a scene already *is* the
configuration, so it stays one draggable item per scene.

## Action model

`crates/mapping/src/action.rs` — `ObsAction` variants become:

```rust
pub enum ObsAction {
    SwitchScene { scene: String },
    Recording { mode: RecordingMode },       // Start | Stop | Pause | Resume | Toggle
    Streaming { mode: StartStopToggle },     // Start | Stop | Toggle
    VirtualCam { mode: StartStopToggle },
    StudioMode { mode: StudioModeMode },     // Enable | Disable | Toggle | TriggerTransition
    SourceMute { source: String, mode: MuteMode },       // Mute | Unmute | Toggle
    SourceVisibility { scene: String, source: String, mode: VisibilityMode }, // Show | Hide | Toggle
    SourceVolume { source: String, mode: VolumeMode },
}

pub enum VolumeMode {
    Absolute { percent: f32 },
    Relative { delta_percent: f32 },
}
```

`src/types.ts` mirrors this 1:1 (tag `op`, `snake_case`, matching the
existing convention). This **breaks** the shape of previously-saved
`start_recording`/`stop_recording`/etc. actions — accepted as a tradeoff
given the app is pre-1.0/MVP (per the existing "no codegen sync" note at the
top of `types.ts`). No migration code is written for this.

Dropping a family card from the sidebar creates the action with its default:
`toggle` for every mode-only family; `SourceMute`/`SourceVisibility`/
`SourceVolume` start with an empty `source` (and `scene`, for Visibility) to
be filled in via the Properties Panel.

## Live OBS data

`ObsStatus::Connected` (`crates/integrations/src/obs.rs`) gains `inputs:
Vec<String>` — all OBS inputs, fetched once at connect alongside `scenes`,
reused by both the Source Mute and Source Volume pickers.

Scene items are per-scene and only needed when configuring a Source
Visibility action, so they are **not** prefetched. A new Tauri command,
`obs_scene_items(scene: String) -> Result<Vec<String>, String>`, is added;
`ObsIntegration` gets a matching `scene_items()` method using the same
`block_on` pattern as `run_action`. The Properties Panel calls it on demand
once a scene is picked.

At execution time, `SourceVisibility` resolves `(scene, source)` to a scene
item id via `client.scene_items().id(...)` immediately before calling
`set_enabled` — the id is never stored in the action, since it can shift if
scene contents change; resolving by name at fire-time is more robust than
caching a possibly-stale id.

## Sidebar (`src/components/ActionsSidebar.tsx`)

One draggable card per family under "OBS Studio": "Recording Control",
"Streaming Control", "Virtual Camera", "Studio Mode", "Source Mute", "Source
Visibility", "Source Volume" (scenes remain individual items, as today).
Card payload carries the default mode described above. Existing
search/breadcrumb behavior (label + category/subcategory) needs no changes.

## Properties Panel (`src/components/PropertiesPanel.tsx`)

Each assigned action becomes inline-editable instead of static label text:

- Mode-only families (Recording, Streaming, Virtual Camera, Studio Mode):
  a `<select>` of that family's valid modes.
- Source Mute / Source Volume: a `<select>` populated from
  `obsStatus.inputs` (already in memory) plus mode controls; Source Volume
  additionally toggles Absolute (0–100+ percent) vs Relative (± delta
  percent).
- Source Visibility: a scene `<select>` (from `obsStatus.scenes`), then,
  once picked, a source `<select>` populated by calling
  `obs_scene_items(scene)`.

A new `onUpdateAction(index: number, action: Action) => void` prop
(parallel to the existing `onRemoveAction`) replaces an action in place, so
edits don't require removing and re-dragging.

## Error handling

An action fired with an unset `source`/`scene` (never configured after
being dropped) fails at execution with
`ActionError::Failed("<field> not set")` — surfaced through the exact same
path as today's "OBS is not connected" errors; no new error UI. Triggering
a studio transition while not in studio mode is left to OBS's own behavior
(already handled generically by the existing error path).

## Testing

- Rust: unit tests in `crates/mapping` covering (de)serialization
  round-trips of every new `ObsAction` variant through the profile JSON
  format, plus a `scene_items` resolution error test for an unknown source.
- Frontend: no existing test harness touches `ActionsSidebar` /
  `PropertiesPanel`; verified manually via `npm run tauri dev` against a
  real OBS instance (and the mock device) rather than introducing a new
  test harness for this alone.
