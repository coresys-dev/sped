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

function controlDisplayName(id: ControlId): string {
  return id
    .split("-")
    .map((part) => part.toUpperCase())
    .join(" ");
}

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
              min={0}
              step={1}
              value={action.mode.percent}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                onChange({
                  ...action,
                  mode: { kind: "absolute", percent: n },
                });
              }}
            />
          ) : (
            <input
              type="number"
              className={SELECT_CLASS}
              step={1}
              value={action.mode.delta_percent}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                onChange({
                  ...action,
                  mode: { kind: "relative", delta_percent: n },
                });
              }}
            />
          )}
        </div>
      );
  }
}

export function PropertiesPanel({
  control,
  actions,
  obsStatus,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
}: PropertiesPanelProps) {
  const [recorderKey, setRecorderKey] = useState(0);

  return (
    <aside className="animate-chrome-in flex h-full w-72 shrink-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-float">
      {!control ? (
        <div className="text-xs text-text-muted">Select a control</div>
      ) : (
        <>
          <div className="mb-4 text-base font-semibold tracking-wide text-text">
            {controlDisplayName(control)}
          </div>

          <div className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
            Assigned actions
          </div>

          {actions.length === 0 && (
            <div className="mb-3 text-xs text-text-muted">No actions assigned</div>
          )}

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

          <div className="mb-4 flex flex-col gap-1.5">
            <span className="text-[11px] text-text-muted">Keyboard shortcut</span>
            <ShortcutRecorder
              key={recorderKey}
              value="+ Add keyboard shortcut…"
              recordingLabel="Press keys…"
              onChange={(combo) => {
                onAddAction({ kind: "keyboard", keys: comboStringToKeys(combo) });
                setRecorderKey((k) => k + 1);
              }}
            />
          </div>

          <p className="text-[11px] leading-relaxed text-text-muted">
            Drag an OBS action from the sidebar onto this control, or record a keyboard shortcut
            above.
          </p>
        </>
      )}
    </aside>
  );
}
