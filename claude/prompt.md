````markdown

You are building a polished, production-oriented desktop application for the **Blackmagic Design DaVinci Resolve Speed Editor**.

The goal is to turn the Speed Editor into a **general-purpose programmable control surface**, inspired by the configuration UX of Elgato Stream Deck, but specifically designed around the physical layout, controls and workflow of the Speed Editor.

The application should be built as a **Rust + Tauri desktop app**. Prioritize a native, lightweight architecture and clean separation between the Rust device/backend layer and the frontend UI.

---

## 1. Product concept

The application allows users to:

1. Connect a Blackmagic Speed Editor via USB.
2. Detect the device and display its connection state.
3. Visually reconstruct the physical Speed Editor in the application.
4. Click any physical control in the visual representation to select it.
5. Assign actions to controls.
6. Create custom mappings and profiles.
7. Use keyboard shortcuts as actions.
8. Integrate with applications such as OBS Studio.
9. Automatically switch profiles depending on the foreground application.
10. Support multiple actions per physical control.
11. Eventually support modifiers, macros, conditions and advanced integrations.

Think:

> **Stream Deck configurator UX + Speed Editor hardware + creator-focused integrations.**

Do NOT make this feel like a generic keyboard remapper. The physical Speed Editor should be the center of the experience.

---

# 2. Tech stack

## Backend

- Rust
- Tauri
- Use the existing Rust Speed Editor ecosystem where appropriate.
- Investigate and use `bmdse` if its current API and license are suitable.
- Communicate with the Speed Editor through USB HID.
- USB support is the priority for the first version.
- Bluetooth is explicitly out of scope for the MVP unless implementation is trivial and does not compromise architecture.

## Frontend

Use the frontend stack already configured by the repository if one exists.

If starting from scratch, prefer:

- TypeScript
- React
- components from https://github.com/coresys-dev/cscl-ui
- modern CSS
- no unnecessary UI framework unless it clearly improves consistency

The frontend must communicate with Rust through Tauri commands/events.

## Architecture

Keep these concerns separate:

```text
Rust
├── device
│   ├── Speed Editor detection
│   ├── HID communication
│   ├── button events
│   ├── jog events
│   └── shuttle events
│
├── mapping
│   ├── controls
│   ├── actions
│   ├── profiles
│   ├── modifiers
│   └── persistence
│
├── integrations
│   ├── keyboard
│   ├── OBS
│   └── future integrations
│
├── application detection
│
└── Tauri commands/events

Frontend
├── Speed Editor visualizer
├── action sidebar
├── properties panel
├── profile manager
├── integration manager
└── settings
````

Do not tightly couple the UI to the HID implementation.

---

# 3. IMPORTANT: inspect the repository first

Before writing code:

1. Inspect the entire repository.
2. Identify the existing Tauri/frontend setup.
3. Identify existing conventions.
4. Identify package manager.
5. Identify Rust edition and dependencies.
6. Check whether there is already an application shell/design system.
7. Check git status.
8. Do not unnecessarily replace existing infrastructure.

Then create a short implementation plan before modifying files.

---

# 4. Speed Editor physical layout

The application must visually reproduce the physical Speed Editor rather than representing it as a generic grid.

Use the provided HTML reference:

`speed-editor-layout.html`

Treat it as a **layout reference/prototype**, not necessarily production code.

The visualizer must contain the actual Speed Editor controls and their approximate physical positions.

Important controls include:

### Trim / edit controls

* TRIM IN
* TRIM OUT
* ROLL
* SLIP SRC
* SLIP DEST
* TRANS DUR
* CUT
* DIS
* SMTH CUT
* IN
* OUT

### Editing / transport controls

* SMART INSERT
* APPND
* CLOSE UP
* PLACE ON TOP
* RIPL OWR
* SRC OWR

### Main editing controls

* ESC
* SYNC BIN
* AUDIO LEVEL
* FULL VIEW
* TRANS TITLE
* SPLIT
* SNAP
* RIPL DEL

### Camera / source controls

* CAM 1
* CAM 2
* CAM 3
* CAM 4
* CAM 5
* CAM 6
* CAM 7
* CAM 8
* CAM 9
* LIVE OWR
* VIDEO ONLY
* AUDIO ONLY

### Transport

* STOP/PLAY

### Main wheel

* JOG
* SHUTTLE
* SCRL

### Source / timeline

* SOURCE
* TIMELINE

The exact visual proportions should follow the provided reference as closely as reasonably possible.

Do not invent additional physical buttons.

---

# 5. Visualizer behavior

Every physical control must be an interactive UI element.

States:

* default
* hover
* selected
* currently pressed
* disabled
* assigned
* currently active

A selected control should be visually obvious.

Example:

```text
CUT
└── selected
    └── purple accent outline
```

Use a restrained premium aesthetic.

Avoid excessive gradients, huge shadows, glassmorphism or generic SaaS aesthetics.

The product should feel like professional creative software.

Suggested visual direction:

* dark UI
* near-black background
* neutral gray hardware
* white/light physical keys where applicable
* restrained accent color
* subtle borders
* subtle depth
* compact typography
* professional desktop application feel

Do not copy Elgato's branding.

---

# 6. Application layout

Build the main window around three areas.

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├──────────────┬──────────────────────────────┬────────────────┤
│              │                              │                │
│   ACTIONS    │      SPEED EDITOR            │   PROPERTIES   │
│   SIDEBAR    │      VISUALIZER              │     PANEL      │
│              │                              │                │
│              │                              │                │
│              │                              │                │
└──────────────┴──────────────────────────────┴────────────────┘
```

## Left sidebar

Contains available actions/integrations.

Categories:

```text
Keyboard
OBS Studio
System
Media
Applications
```

Actions should be draggable.

## Center

Interactive Speed Editor representation.

## Right panel

Displays the selected control and its configuration.

Example:

```text
CUT

Assigned actions

┌──────────────────────────────┐
│ Keyboard                     │
│ Ctrl + B                     │
└──────────────────────────────┘

+ Add Action
```

If nothing is selected:

```text
Select a control
```

---

# 7. Drag and drop

Implement real drag-and-drop.

Example:

User selects:

```text
OBS Studio
└── Scenes
    ├── Camera 1
    ├── Camera 2
    ├── Gameplay
    └── Desktop
```

They drag:

```text
Gameplay
```

onto:

```text
CAM 1
```

Result:

```text
CAM 1
└── OBS Studio
    └── Switch Scene
        → Gameplay
```

The UI must make this relationship obvious.

Support both:

* drag-and-drop
* manual assignment from the properties panel

Do not make drag-and-drop the only way to configure controls.

---

# 8. Keyboard actions

Provide a keyboard action editor.

Example:

```text
Keyboard Shortcut

[ Ctrl ] [ B ]
```

Allow arbitrary combinations.

Support:

* modifier keys
* normal keys
* function keys
* media keys where supported

The user should be able to click a shortcut input and press the desired combination.

Store shortcuts in a normalized internal representation rather than as arbitrary display strings.

Example:

```json
{
  "type": "keyboard",
  "keys": ["CTRL", "B"]
}
```

---

# 9. Multiple actions

A physical control may contain multiple actions.

Example:

```text
CUT

1. Keyboard → Ctrl+B
2. OBS → Switch Scene → Camera 2
```

Execute actions in deterministic order.

The architecture must support this from the beginning even if the initial UI only exposes a simple workflow.

---

# 10. Profiles

Implement a profile system.

Example:

```text
Profiles

Default
DaVinci Resolve
OBS Studio
Premiere Pro
Ableton Live
```

Each profile contains mappings.

Users must be able to:

* create profile
* duplicate profile
* rename profile
* delete profile
* select active profile
* export profile
* import profile

Persist profiles locally.

Use a versioned serialization format.

Example:

```json
{
  "version": 1,
  "profile": "OBS Studio",
  "mappings": {}
}
```

Do not hard-code mappings into frontend code.

---

# 11. Application-aware profiles

Prepare the architecture for automatic profile switching based on the active application.

Example:

```text
DaVinci Resolve active
→ DaVinci profile

OBS active
→ OBS profile
```

The first implementation may use a simple application-name/process-name detector.

Do not make this OS-specific logic part of the frontend.

Create a backend abstraction such as:

```rust
trait ActiveApplicationDetector {
    fn active_application(&self) -> Result<ApplicationInfo>;
}
```

Platform-specific implementations can come later.

---

# 12. OBS integration

OBS should be treated as a first-class integration.

Use the OBS WebSocket protocol rather than relying exclusively on keyboard shortcuts.

The user should be able to configure an OBS connection.

Example:

```text
OBS Studio

Status:
● Connected

Scenes
──────────────
Camera 1
Camera 2
Camera 3
Gameplay
Desktop
```

Actions should include at minimum:

* Switch scene
* Start recording
* Stop recording
* Pause recording
* Resume recording
* Start streaming
* Stop streaming

Prepare the architecture for:

* mute/unmute source
* set volume
* toggle source visibility
* transition
* replay buffer
* screenshot

Do not hard-code scene names.

Retrieve them dynamically from OBS when connected.

If OBS is unavailable, show a useful connection state instead of crashing.

---

# 13. Device layer

The Rust backend must expose a clean device abstraction.

Something conceptually like:

```rust
trait ControlSurface {
    fn connect(&mut self) -> Result<()>;
    fn disconnect(&mut self) -> Result<()>;
    fn controls(&self) -> &[Control];
}
```

Then:

```rust
SpeedEditor
```

implements the abstraction.

The rest of the application should not need to know HID packet details.

---

# 14. Device events

The backend should normalize raw Speed Editor events into application-level events.

For example:

```rust
enum ControlEvent {
    Pressed(ControlId),
    Released(ControlId),
    Jog { delta: i32 },
    Shuttle { value: i32 },
}
```

The mapping engine consumes these events.

Do NOT let UI components directly interpret HID packets.

Architecture:

```text
HID packet
    ↓
Speed Editor driver
    ↓
normalized ControlEvent
    ↓
mapping engine
    ↓
Action
    ↓
integration
```

---

# 15. Mapping engine

Create a proper mapping engine rather than implementing mappings as frontend callbacks.

Conceptually:

```text
ControlEvent
    ↓
Active Profile
    ↓
Mapping
    ↓
Conditions
    ↓
Actions
    ↓
Action Executor
```

This will allow future features such as:

* modifiers
* layers
* macros
* conditions
* application-specific mappings
* long press
* double press
* hold
* release
* wheel sensitivity

without rewriting the core architecture.

---

# 16. Modifiers / layers

Prepare support for modifier states.

Example:

```text
CUT

Normal
→ Ctrl+B

Shift
→ OBS: Camera 1

Alt
→ OBS: Camera 2

Ctrl
→ Start Recording
```

This does not have to be fully exposed in the first UI version, but the data model should not prevent it.

---

# 17. Jog wheel

Treat the jog wheel as a continuous input rather than a button.

Normalized event:

```rust
Jog {
    delta: i32
}
```

Eventually actions could include:

* send repeated key presses
* change OBS volume
* scrub timeline
* change brush size
* change numeric parameter

The initial implementation should at least detect and log jog movement.

Do not fake jog behavior in production.

---

# 18. Physical-device feedback

If the Speed Editor supports any meaningful LED/key feedback through the reverse-engineered protocol, investigate it.

Do NOT make this a blocker for MVP.

First priority:

```text
physical input → software action
```

Later:

```text
software state → Speed Editor feedback
```

---

# 19. Persistence

Store application configuration in the appropriate Tauri application data directory.

Persist:

* profiles
* mappings
* integration settings
* application associations
* user preferences

Never store secrets in plaintext if avoidable.

OBS passwords/tokens or future API credentials should use the OS credential/keychain mechanism where practical.

---

# 20. Error handling

The application must gracefully handle:

* Speed Editor disconnected
* Speed Editor connected after startup
* HID initialization failure
* unsupported device
* malformed mapping
* OBS unavailable
* OBS disconnected
* invalid shortcut
* missing application
* corrupted profile

Never panic on normal device/network errors.

Display useful human-readable errors.

---

# 21. Device connection UI

Header should show something similar to:

```text
● Speed Editor
Connected
```

Disconnected:

```text
○ Speed Editor
Disconnected
```

If no device exists, the app must still open and allow configuration.

When the device is connected later, automatically initialize it.

---

# 22. Development / debug mode

Create a development/debug capability allowing events to be inspected.

Example:

```text
Speed Editor Events

12:31:02  CUT        Pressed
12:31:02  CUT        Released
12:31:05  JOG        +3
12:31:05  JOG        +1
12:31:07  CAM_1      Pressed
```

This will be extremely useful for reverse engineering and testing.

Make sure debug logging can be disabled in production.

---

# 23. Testing strategy

Write tests for:

### Mapping engine

* button → action
* multiple actions
* profile switching
* invalid mappings
* modifier mappings

### Serialization

* save profile
* load profile
* migration/version handling

### OBS

* action serialization
* connection state
* scene mapping

### Device

Where real hardware cannot be tested automatically, create a mock device implementation.

Example:

```rust
MockSpeedEditor
```

This should allow development without the physical device.

---

# 24. Mock device mode

This is important.

Create a mock event source that allows the frontend and mapping engine to be developed without the Speed Editor connected.

Example:

```text
Mock Controls

[ CUT ]
[ CAM 1 ]
[ STOP/PLAY ]
[ JOG + ]
[ JOG - ]
```

This can eventually become a developer-only panel.

---

# 25. Accessibility / UX

Controls should have meaningful accessible names.

Keyboard navigation should be possible where reasonable.

Avoid relying exclusively on color to indicate states.

Animations should be subtle and fast.

The UI should feel responsive immediately.

---

# 26. Design principles

The application should feel:

* professional
* technical
* compact
* precise
* premium
* creator-oriented

Avoid:

* generic admin dashboards
* oversized cards
* excessive rounded rectangles
* unnecessary gradients
* excessive animations
* excessive empty space
* generic AI/SaaS aesthetics

The Speed Editor itself should visually dominate the center of the application.

---

# 27. Suggested product terminology

Use terminology consistently.

Prefer:

* Control
* Action
* Mapping
* Profile
* Integration
* Trigger
* Device
* Layer
* Modifier

Avoid calling everything a "button", because Jog and Shuttle are not simple buttons.

---

# 28. MVP scope

The first working version MUST prioritize functionality over visual perfection.

MVP requirements:

1. Tauri app launches.
2. Speed Editor detected over USB.
3. Raw device events are received.
4. Events are normalized.
5. Visual Speed Editor is displayed.
6. Clicking a control selects it.
7. Physical button presses highlight the corresponding visual control.
8. Keyboard actions can be assigned.
9. Assigned keyboard actions execute.
10. Profiles can be saved/loaded.
11. Mock device works without hardware.
12. OBS integration architecture exists.
13. OBS scene switching works if an OBS connection is configured.
14. Device disconnect/reconnect works.

Do not implement Bluetooth before these work.

---

# 29. Important implementation rule

Do not build the entire application in one giant pass.

Work incrementally.

Recommended order:

```text
Phase 1
Repository inspection
Architecture
Dependency research

Phase 2
Speed Editor HID prototype
Event logging
Mock device

Phase 3
Device abstraction
Normalized events
Mapping engine

Phase 4
Tauri ↔ frontend communication

Phase 5
Speed Editor visualizer

Phase 6
Keyboard mapping

Phase 7
Profiles / persistence

Phase 8
OBS integration

Phase 9
Application-aware profiles

Phase 10
UX polish
Testing
Packaging
```

At the end of each phase, verify that the project still builds and runs.

---

# 30. Research requirements

Before implementing the Speed Editor driver:

Investigate:

* `bmdse`
* its current API
* its license
* HID protocol details
* authentication/handshake requirements
* supported Speed Editor events
* USB identifiers
* jog/shuttle events
* whether output/LED control is possible

Do not blindly copy code from another project.

If an existing library has an incompatible license for a future commercial product, do not import it into the application. Instead, determine whether it can be used as a reference and implement an independent compatible abstraction.

Document this decision in the repository.

---

# 31. Commercial-product mindset

Assume this may eventually become a commercial CoreSys application.

Therefore:

* avoid GPL/AGPL dependencies unless explicitly approved
* check licenses before adding dependencies
* prefer MIT/BSD/Apache-compatible dependencies
* do not embed proprietary Blackmagic assets
* do not imply official Blackmagic endorsement
* keep third-party code clearly separated
* document third-party licenses

The visual reconstruction should be an original implementation based on the hardware layout, not a copy of Blackmagic's software UI.

---

# 32. Future architecture

Do not implement these yet unless trivial, but ensure the architecture can support them:

### Other integrations

```text
OBS
DaVinci Resolve
Premiere Pro
After Effects
Photoshop
Ableton Live
System
MIDI
HTTP
WebSocket
AppleScript
PowerShell
Shell
```

### Advanced triggers

```text
Press
Release
Hold
Double press
Long press
Jog clockwise
Jog counter-clockwise
Shuttle position
```

### Advanced actions

```text
Keyboard
Mouse
Application command
HTTP request
WebSocket message
MIDI
OBS command
Script
Macro
```

### Layers

```text
Layer 1
Layer 2
Layer 3
```

Potentially turning the relatively small number of physical controls into a very large programmable control surface.

---

# 33. Code quality

Use idiomatic Rust.

Prefer:

* strong types
* enums
* clear modules
* `Result` / proper error types
* minimal global state
* async only where appropriate
* explicit ownership
* structured logging

Avoid:

* `unwrap()` in production paths
* giant modules
* giant Tauri commands
* frontend-owned business logic
* hard-coded profile mappings
* HID implementation leaking into UI code

Use comments where architectural decisions are non-obvious, not for obvious code.

---

# 34. Deliverables

By the end of the implementation, provide:

1. Working Tauri application.
2. Rust Speed Editor abstraction.
3. USB HID communication.
4. Normalized device events.
5. Interactive visual Speed Editor.
6. Keyboard mapping.
7. Mapping engine.
8. Profile persistence.
9. Mock device.
10. OBS integration.
11. Basic application detection abstraction.
12. Tests for mapping and persistence.
13. README with:

    * setup
    * development
    * architecture
    * supported hardware
    * supported integrations
    * dependency licenses
    * known limitations
14. Clear TODO list for future features.

---

# 35. Final UX target

The end result should make this workflow feel natural:

```text
Connect Speed Editor
        ↓
Application detects it
        ↓
Visual Speed Editor appears
        ↓
Click CAM 1
        ↓
Sidebar → OBS Studio
        ↓
Scenes
        ↓
Drag "Gameplay"
        ↓
Drop on CAM 1
        ↓
CAM 1 now represents:
OBS → Switch Scene → Gameplay
```

Then pressing the physical:

```text
CAM 1
```

should actually switch OBS to:

```text
Gameplay
```

Likewise:

```text
CUT → Ctrl+B
STOP/PLAY → Space
CAM 2 → OBS → Camera 2
```

The critical concept is that **the visual representation and the physical hardware must always correspond**.

If CAM 1 is selected/configured in the UI, the user should immediately understand that they are configuring the physical CAM 1 key in front of them.

---

# 36. Start now

First:

1. Inspect the repository.
2. Inspect the supplied `speed-editor-layout.html`.
3. Determine the current project structure.
4. Research the available Rust Speed Editor libraries and their licenses.
5. Create the architecture/implementation plan.
6. Implement the smallest possible USB device prototype.
7. Verify that real Speed Editor button events can be received.
8. Only then proceed toward the UI and mapping engine.

Do not ask unnecessary clarification questions. Make reasonable technical decisions, document them, and keep the implementation incremental.

The priority is:

**real hardware communication → clean architecture → working mappings → integrations → polished UI.**

```
```