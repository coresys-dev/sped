# Speed Editor Control

A programmable control surface application for the Blackmagic Design DaVinci
Resolve Speed Editor -- Stream Deck-style configurator UX, built around the
Speed Editor's actual physical layout, with Rust + Tauri.

> Not affiliated with or endorsed by Blackmagic Design. "DaVinci Resolve" and
> "Speed Editor" are trademarks of Blackmagic Design Pty. Ltd.

## Status

MVP. Real-hardware button/wheel events, a to-scale interactive visualizer,
keyboard-shortcut mapping, JSON profiles, and a first-class OBS WebSocket
integration all work end-to-end. See [Known limitations](#known-limitations)
and [TODO](#todo--future-work).

## Setup

Prerequisites:

- Rust (stable, 2021 edition) and Cargo
- Node.js 20+ and [pnpm](https://pnpm.io/)
- Windows, macOS or Linux with the Tauri v2 platform dependencies for your OS
  (see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/))

```bash
pnpm install
pnpm tauri dev
```

To develop the mapping engine, profiles and UI without a physical Speed
Editor attached, run with the mock device layer enabled:

```bash
# bash / zsh
SPED_MOCK=1 pnpm tauri dev

# PowerShell
$env:SPED_MOCK = "1"; pnpm tauri dev
```

In mock mode a developer panel (bottom-right, dev builds only) shows the raw
event log and lets you trigger button/jog events without hardware.

### Build

```bash
pnpm tauri build
```

### Tests

```bash
cargo test --workspace
```

## UI system

The frontend uses Tailwind v4 (`@tailwindcss/vite`) plus `src/cscl-ui/` --
CoreSys's internal shadcn-ui-style component library, vendored in per its own
copy-and-own convention (see `src/cscl-ui/README.md`): window chrome
(`TitleBar`/`WindowControls`, fully custom on Windows/Linux via
`decorations: false`), design tokens (`theme/tokens.css`, `theme/motion.css`),
and primitives/overlays (`Button`, `IconButton`, `Switch`, `Slider`,
`ShortcutRecorder`, `DropdownMenu`, `SidebarTabsDialog`, ...). `ShortcutRecorder`
is intentionally patched from upstream to allow modifier-less combos (e.g.
`Space`) -- see the comment in `src/cscl-ui/inputs/ShortcutRecorder.tsx`.
macOS native-traffic-light repositioning (`position_traffic_lights` in
`src-tauri/src/window_chrome.rs`) is a documented no-op: implementing it needs
Cocoa/objc code from CoreSys's other apps that isn't available here, and this
project has only been built/tested on Windows.

## Architecture

```text
Rust workspace
├── crates/device        HID transport, ControlId/ControlEvent, mock device
├── crates/mapping        Profiles, mappings, actions, the mapping engine
├── crates/integrations   Keyboard (enigo), OBS (obws), active-app detection
└── src-tauri              Tauri commands/events, app state, wiring only

Frontend (src/)
├── components/SpeedEditor.tsx   To-scale visual reconstruction of the device
├── components/ActionsSidebar.tsx  Draggable actions (Keyboard, OBS, ...)
├── components/PropertiesPanel.tsx Selected control's assigned actions
├── components/ProfileManager.tsx  Profile CRUD + import/export
└── api.ts                        Typed wrapper over Tauri invoke/events
```

Event flow, from hardware to effect:

```text
HID packet
    -> bmd-speededitor (auth handshake, key/jog decoding)
    -> SpeedEditorSurface (crates/device)         -- normalizes to ControlEvent
    -> MappingEngine (crates/mapping)              -- resolves active Profile
    -> Dispatcher -> ActionExecutor impls           -- KeyboardExecutor / ObsIntegration
    -> emitted to frontend as "device-event"        -- visualizer highlights the control
```

The device layer, mapping engine and integrations are three separate crates
specifically so that:

- The mapping engine and frontend can be developed/tested with zero hardware
  (`MockSurface`, `SPED_MOCK=1`).
- A future second control surface only needs a new `ControlSurface`
  implementation; nothing above it changes.
- A future integration (MIDI, HTTP, AppleScript, a second creative app) only
  needs a new `Action` variant and executor; the engine, profiles and
  frontend are unaffected.

See `claude/docs/decisions/` for the reasoning behind specific choices
(HID driver dependency, action/profile data model).

## Supported hardware

- Blackmagic Design DaVinci Resolve Speed Editor, connected via **USB**
  (VID `0x1EDB`, PID `0xD9CE`).
- Bluetooth is out of scope for this MVP.

## Supported integrations

- **Keyboard**: arbitrary shortcuts (modifiers, letters/digits, function
  keys, navigation, media keys) synthesized with `enigo`.
- **OBS Studio**: first-class OBS WebSocket (v5) integration via `obws`.
  Scene list is always fetched live, never hard-coded. Supports switching
  scenes and start/stop/pause/resume recording, start/stop streaming.
  Architecture reserves room for mute/volume/source-visibility/transition/
  replay-buffer/screenshot actions without a profile-format change.
- **Active-application detection**: `ActiveApplicationDetector` trait in
  `sped-integrations`, with a Windows implementation
  (`WindowsForegroundDetector`, Win32 foreground-window + process lookup).
  Not yet wired into automatic profile switching in the UI (see TODO).

## Dependency licenses

Everything below is MIT, Apache-2.0, or dual MIT/Apache-2.0 -- all
compatible with a future closed-source/commercial build. No GPL/AGPL
dependencies.

| Crate | License | Role |
|---|---|---|
| `bmd-speededitor` | MIT | Speed Editor HID transport + auth (see decision 0001) |
| `hidapi` | MIT | Low-level HID (transitive, via `bmd-speededitor`) |
| `enigo` | MIT | Synthesizing keyboard input |
| `obws` | MIT | OBS WebSocket v5 client |
| `windows` | MIT OR Apache-2.0 | Win32 foreground-window detection |
| `tokio` | MIT | Async runtime backing the OBS integration |
| `serde` / `serde_json` | MIT OR Apache-2.0 | Profile/event serialization |
| `thiserror` | MIT OR Apache-2.0 | Error types |
| `tracing` | MIT | Structured logging |
| `chrono`, `num_enum`, `strum` | MIT / dual | Transitive, via `bmd-speededitor` |
| Tauri (`tauri`, `tauri-build`, `tauri-plugin-*`) | MIT OR Apache-2.0 | App shell |

The Speed Editor authentication algorithm implemented inside
`bmd-speededitor` is itself a Rust port of the Apache-2.0-licensed
[`smunaut/blackmagic-misc`](https://github.com/smunaut/blackmagic-misc). See
`claude/docs/decisions/0001-speed-editor-driver.md` for the full trail.

## Known limitations

- Application-aware automatic profile switching: the detector trait and a
  Windows implementation exist, but nothing in `src-tauri` polls it or
  switches profiles yet.
- Modifiers/layers (`Modifier::Shift/Alt/Ctrl`) are in the data model and the
  engine's resolution logic, but nothing in the UI or device layer currently
  arms a non-`None` modifier (no host-keyboard-modifier listener yet).
- Hold / double-press / long-press triggers exist in the `Trigger` enum but
  the engine only currently resolves `Press`/`Release`.
- No LED/key feedback (software state -> device) yet; `bmd-speededitor`
  exposes the primitives (`KeyLed`, `set_key_led`) for when this is tackled.
- Wheel sensitivity/invert (Settings -> Device) scales the jog/shuttle delta
  once in `device_manager.rs`, so it affects the visualizer's rotation now;
  it has no effect on actions yet since the mapping engine doesn't resolve
  `Jog`/`Shuttle` events to actions yet (no acceleration curve either).
- Import/export currently round-trips through the browser's file
  download/upload rather than a native save/open dialog.
- macOS native traffic-light repositioning is a documented no-op (see
  "UI system" above) -- untested, not implemented, Windows/Linux only for now.

## TODO / future work

- [ ] Wire `ActiveApplicationDetector` into automatic profile switching.
- [ ] Host-keyboard modifier listener to actually arm `Modifier` layers.
- [ ] Hold / double-press / long-press trigger resolution in `MappingEngine`.
- [ ] LED feedback (assigned/active state reflected on the physical device).
- [ ] Jog/shuttle sensitivity curves and richer wheel actions (scrub
      timeline, numeric parameter, brush size, OBS volume).
- [ ] Additional integrations: MIDI, HTTP/WebSocket, AppleScript/PowerShell,
      per-app (DaVinci Resolve, Premiere, After Effects, Photoshop, Ableton).
- [ ] macOS/Linux `ActiveApplicationDetector` implementations.
- [ ] Native save/open dialogs for profile import/export
      (`tauri-plugin-dialog` + `tauri-plugin-fs`).
- [ ] Layers (multiple mapping "pages" per profile, cycled via a control).
