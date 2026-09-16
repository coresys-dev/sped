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

export type Action = KeyboardAction | ObsAction;

export type Trigger = "press" | "release" | "hold" | "double_press" | "long_press";
export type Modifier = "none" | "shift" | "alt" | "ctrl";

export interface Mapping {
  trigger: Trigger;
  modifier: Modifier;
  actions: Action[];
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
  | { state: "connected"; scenes: string[] }
  | { state: "error"; message: string };

export interface DeviceStatus {
  connected: boolean;
  mock: boolean;
}

export interface ObsSettings {
  host: string;
  port: number;
  autoconnect: boolean;
}

export interface JogSettings {
  sensitivity: number;
  invert: boolean;
}

export interface GeneralSettings {
  debugOverlay: boolean;
}

export interface AppSettings {
  obs: ObsSettings;
  jog: JogSettings;
  general: GeneralSettings;
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

export function keyboardAction(keys: string[]): KeyboardAction {
  return { kind: "keyboard", keys };
}

export function obsSwitchScene(scene: string): ObsSwitchScene {
  return { kind: "obs", op: "switch_scene", scene };
}

export function actionLabel(action: Action): string {
  if (action.kind === "keyboard") {
    return action.keys.join(" + ");
  }
  switch (action.op) {
    case "switch_scene":
      return `Switch Scene → ${action.scene}`;
    case "start_recording":
      return "Start Recording";
    case "stop_recording":
      return "Stop Recording";
    case "pause_recording":
      return "Pause Recording";
    case "resume_recording":
      return "Resume Recording";
    case "start_streaming":
      return "Start Streaming";
    case "stop_streaming":
      return "Stop Streaming";
  }
}

export function actionCategory(action: Action): string {
  return action.kind === "keyboard" ? "Keyboard" : "OBS Studio";
}
