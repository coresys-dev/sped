// Mirrors the Rust types in crates/mapping and crates/device. Keep these
// in sync manually -- there is no codegen step for the MVP.

export type ControlId = string; // e.g. "cut", "cam-1", "jog" -- see ControlId::as_str()

export interface KeyboardAction {
  kind: "keyboard";
  keys: string[];
}

export interface ObsSwitchScene {
  kind: "obs";
  op: "switch_scene";
  scene: string;
}

export type RecordingMode = "start" | "stop" | "pause" | "resume" | "toggle";
export type StartStopToggle = "start" | "stop" | "toggle";
export type StudioModeMode = "enable" | "disable" | "toggle" | "trigger_transition";
export type MuteMode = "mute" | "unmute" | "toggle";
export type VisibilityMode = "show" | "hide" | "toggle";

export type VolumeUnit = "percent" | "db";

export type VolumeMode =
  | { kind: "absolute"; value: number; unit: VolumeUnit }
  | { kind: "relative"; value: number; unit: VolumeUnit };

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

export type Action = KeyboardAction | ObsAction;

export type Trigger =
  | "press"
  | "release"
  | "hold"
  | "double_press"
  | "long_press"
  | "jog_clockwise"
  | "jog_counter_clockwise"
  | "jog_continuous";
export type Modifier = "none" | "shift" | "alt" | "ctrl";

/** The synthetic `ControlId` for the wheel's *motion* while in jog mode
 * (`jog_clockwise`/`jog_counter_clockwise`/`jog_continuous` mappings) --
 * distinct from `"jog"`, the button press that selects jog mode. See
 * `sped_device::ControlId::JogWheel`'s doc comment. */
export const JOG_WHEEL_CONTROL_ID: ControlId = "jog-wheel";

export interface Mapping {
  trigger: Trigger;
  modifier: Modifier;
  actions: Action[];
  /** Only meaningful for `jog_clockwise`/`jog_counter_clockwise`: wheel
   * rotation needed in that direction before this mapping fires once. */
  threshold: number;
  /** Only meaningful for `jog_continuous`: multiplies the raw per-event
   * wheel delta into the mapped action's continuous parameter (currently
   * only `source_volume`'s relative `value`). */
  amount_per_tick: number;
}

export function simpleMapping(actions: Action[]): Mapping {
  return { trigger: "press", modifier: "none", actions, threshold: 10, amount_per_tick: 1.0 };
}

export interface Profile {
  version: number;
  name: string;
  mappings: Record<ControlId, Mapping[]>;
}

export type ControlEvent =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "pressed"; control: ControlId }
  | { type: "released"; control: ControlId }
  | { type: "jog"; delta: number }
  | { type: "shuttle"; value: number };

export type MockCommand =
  | { action: "press"; value: ControlId }
  | { action: "release"; value: ControlId }
  | { action: "tap"; value: ControlId }
  | { action: "jog"; value: number }
  | { action: "shuttle"; value: number }
  | { action: "disconnect" }
  | { action: "reconnect" };

export type ObsStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; scenes: string[]; inputs: string[] }
  | { state: "error"; message: string };

export interface DeviceStatus {
  connected: boolean;
  mock: boolean;
}

/** `text-*` token class for an OBS status, shared by every place that
 * displays it so the same state always reads the same color. */
export const OBS_STATUS_COLOR: Record<ObsStatus["state"], string> = {
  connected: "text-accent",
  connecting: "text-accent-2",
  error: "text-danger",
  disconnected: "text-text-muted",
};

export function obsStatusLabel(status: ObsStatus): string {
  switch (status.state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
  }
}

export interface ObsSettings {
  host: string;
  port: number;
  autoconnect: boolean;
}

export interface JogSettings {
  sensitivity: number;
  invert: boolean;
  deadzone: number;
}

export interface GeneralSettings {
  debugOverlay: boolean;
}

export type Language = "en" | "fr";
export type Theme = "dark" | "light";

export interface LedFeedbackSettings {
  enabled: boolean;
  exclusiveCam: boolean;
}

export interface ExperienceSettings {
  language: Language;
  theme: Theme;
  ledFeedback: LedFeedbackSettings;
}

export interface AppSettings {
  obs: ObsSettings;
  jog: JogSettings;
  general: GeneralSettings;
  experience: ExperienceSettings;
}

const COMBO_TOKEN_TO_NORMALIZED: Record<string, string> = {
  Ctrl: "CTRL",
  Alt: "ALT",
  Shift: "SHIFT",
  Super: "META",
};

/** `ShortcutRecorder` (cscl-ui) produces "Ctrl+Shift+K"-style combo
 * strings; our stored `KeyboardAction.keys` is a normalized array
 * (`["CTRL", "SHIFT", "K"]`). Converting at the UI boundary keeps the
 * profile format independent of that component's display convention. */
export function comboStringToKeys(combo: string): string[] {
  return combo.split("+").map((token) => COMBO_TOKEN_TO_NORMALIZED[token] ?? token.toUpperCase());
}

const NORMALIZED_TO_COMBO_TOKEN: Record<string, string> = {
  CTRL: "Ctrl",
  ALT: "Alt",
  SHIFT: "Shift",
  META: "Super",
};

export function keysToComboString(keys: string[]): string {
  return keys.map((key) => NORMALIZED_TO_COMBO_TOKEN[key] ?? key).join("+");
}

/** Controls with a real LED on the hardware -- see `crates/device/src/led.rs`. */
export type LedId =
  | "close-up"
  | "cut"
  | "dis"
  | "smth-cut"
  | "trans-title"
  | "snap"
  | "cam-1"
  | "cam-2"
  | "cam-3"
  | "cam-4"
  | "cam-5"
  | "cam-6"
  | "cam-7"
  | "cam-8"
  | "cam-9"
  | "live-owr"
  | "video-only"
  | "audio-only";

export const LED_IDS: LedId[] = [
  "close-up",
  "cut",
  "dis",
  "smth-cut",
  "trans-title",
  "snap",
  "cam-1",
  "cam-2",
  "cam-3",
  "cam-4",
  "cam-5",
  "cam-6",
  "cam-7",
  "cam-8",
  "cam-9",
  "live-owr",
  "video-only",
  "audio-only",
];

/** The "camera bank" LED group `ExperienceSettings.ledFeedback.exclusiveCam`
 * applies to -- lighting any of these turns off any other lit one in the
 * same group, everything else keeps its own independent state. */
export const LED_CAM_GROUP = new Set<LedId>([
  "cam-1",
  "cam-2",
  "cam-3",
  "cam-4",
  "cam-5",
  "cam-6",
  "cam-7",
  "cam-8",
  "cam-9",
  "live-owr",
]);

export function keyboardAction(keys: string[]): KeyboardAction {
  return { kind: "keyboard", keys };
}

export function obsSwitchScene(scene: string): ObsSwitchScene {
  return { kind: "obs", op: "switch_scene", scene };
}

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
    case "source_volume": {
      const { value, unit } = action.mode;
      const suffix = unit === "db" ? "dB" : "%";
      const shown =
        action.mode.kind === "absolute" ? `${value}${suffix}` : `${value >= 0 ? "+" : ""}${value}${suffix}`;
      return `Source Volume (${action.source || "unset"}) — ${shown}`;
    }
  }
}

export function actionCategory(action: Action): string {
  return action.kind === "keyboard" ? "Keyboard" : "OBS Studio";
}
