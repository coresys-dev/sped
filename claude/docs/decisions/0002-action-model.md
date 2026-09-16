# 0002: Action / mapping data model

## Decision

- `sped-device` owns hardware-agnostic events (`ControlEvent`) and control
  identity (`ControlId`). No knowledge of mappings, profiles or integrations.
- `sped-mapping` owns `Action`, `Mapping`, `Profile`, `Trigger`, `Modifier`
  and the `MappingEngine`. It resolves events to actions but never executes
  them (`ActionExecutor` is a trait it defines but does not implement).
- `sped-integrations` implements `ActionExecutor` per integration (keyboard,
  OBS) and the `ActiveApplicationDetector` trait. It's the only crate allowed
  to depend on `enigo`, `obws`, or platform APIs (`windows` crate).
- `src-tauri` wires everything together via `Dispatcher` and exposes Tauri
  commands; it contains no business logic of its own.

## Why this layering

Every "future architecture" item in the spec (layers, macros, conditions,
long-press, new integrations) is additive at exactly one of these layers:

- A new trigger kind -> add a `Trigger` variant + a branch in
  `MappingEngine::resolve`. Profiles already round-trip unknown-at-the-time
  triggers because of `#[serde(default)]` on `Mapping::trigger`.
- A new integration (MIDI, HTTP, AppleScript, ...) -> add an `Action` variant
  and one executor in `sped-integrations`. Nothing in `sped-device` or the
  frontend needs to change.
- A new device (e.g. a second control surface) -> implement `ControlSurface`
  in `sped-device`; `MappingEngine` and everything above it is unaffected
  because it only ever sees `ControlEvent`.

## Versioned profile format

`Profile::version` / `PROFILE_FORMAT_VERSION` (`crates/mapping/src/profile.rs`)
exists so a future format change can migrate forward
(`Profile::from_json` is the single place a migration would be added) instead
of silently corrupting or rejecting existing user profiles. Profiles newer
than the running app understands are rejected explicitly
(`ProfileError::UnsupportedVersion`) rather than partially loaded.

## Keyboard shortcuts are normalized, not display strings

`KeyboardAction.keys` is `Vec<String>` of normalized names (`"CTRL"`, `"B"`),
never a rendered string like `"Ctrl+B"`. Display formatting
(`actionLabel` in `src/types.ts`) is derived from this, not the other way
around, so locale/layout never leaks into stored profiles.
