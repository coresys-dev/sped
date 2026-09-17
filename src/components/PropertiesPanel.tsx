import { X } from "lucide-react";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { api } from "../api";
import { ShortcutRecorder } from "../cscl-ui/inputs/ShortcutRecorder";
import { IconButton } from "../cscl-ui/primitives/IconButton";
import {
  JOG_WHEEL_CONTROL_ID,
  actionCategory,
  actionLabel,
  comboStringToKeys,
  type Action,
  type ControlId,
  type Mapping,
  type MuteMode,
  type ObsAction,
  type ObsStatus,
  type RecordingMode,
  type StartStopToggle,
  type StudioModeMode,
  type Trigger,
  type VisibilityMode,
  type VolumeUnit,
} from "../types";

export interface JogWheelMappings {
  clockwise: Mapping | undefined;
  counterClockwise: Mapping | undefined;
  continuous: Mapping | undefined;
}

export interface PropertiesPanelProps {
  control: ControlId | null;
  actions: Action[];
  obsStatus: ObsStatus;
  onAddAction: (action: Action) => void;
  onRemoveAction: (index: number) => void;
  onUpdateAction: (index: number, action: Action) => void;
  jogWheelMappings: JogWheelMappings;
  onAddJogAction: (trigger: Trigger, action: Action) => void;
  onRemoveJogAction: (trigger: Trigger, index: number) => void;
  onUpdateJogAction: (trigger: Trigger, index: number, action: Action) => void;
  onUpdateJogConfig: (trigger: Trigger, patch: Partial<Pick<Mapping, "threshold" | "amount_per_tick">>) => void;
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
          <div className="flex gap-1.5">
            <select
              className={SELECT_CLASS}
              value={action.mode.kind}
              onChange={(e) =>
                onChange({
                  ...action,
                  mode:
                    e.target.value === "absolute"
                      ? { kind: "absolute", value: action.mode.unit === "db" ? 0 : 100, unit: action.mode.unit }
                      : { kind: "relative", value: action.mode.unit === "db" ? 1 : 10, unit: action.mode.unit },
                })
              }
            >
              <option value="absolute">Absolute</option>
              <option value="relative">Relative</option>
            </select>
            <select
              className={SELECT_CLASS}
              value={action.mode.unit}
              onChange={(e) => {
                const unit = e.target.value as VolumeUnit;
                onChange({
                  ...action,
                  mode: { ...action.mode, unit },
                });
              }}
            >
              <option value="percent">%</option>
              <option value="db">dB</option>
            </select>
          </div>
          <input
            type="number"
            className={SELECT_CLASS}
            min={action.mode.kind === "absolute" && action.mode.unit === "percent" ? 0 : undefined}
            step={1}
            value={action.mode.value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange({
                ...action,
                mode: { ...action.mode, value: n },
              });
            }}
          />
        </div>
      );
  }
}

interface AssignedActionsProps {
  actions: Action[];
  obsStatus: ObsStatus;
  onAddAction: (action: Action) => void;
  onRemoveAction: (index: number) => void;
  onUpdateAction: (index: number, action: Action) => void;
  /** Renders as a self-contained drop target with its own outline; false
   * when an ancestor (the jog-wheel-less single-control panel) already
   * handles drag/drop for the whole panel. */
  ownDropTarget?: boolean;
}

/** The "assigned actions" list + editors + keyboard-shortcut recorder,
 * factored out so the jog wheel can show three of these (one per
 * trigger) instead of the single one every other control gets. */
function AssignedActions({
  actions,
  obsStatus,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
  ownDropTarget,
}: AssignedActionsProps) {
  const [recorderKey, setRecorderKey] = useState(0);
  const [dropTarget, setDropTarget] = useState(false);

  const dropHandlers = ownDropTarget
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropTarget(true);
        },
        onDragLeave: () => setDropTarget(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDropTarget(false);
          const payload = e.dataTransfer.getData("application/x-sped-action");
          if (!payload) return;
          try {
            onAddAction(JSON.parse(payload) as Action);
          } catch {
            // Ignore malformed drag payloads (e.g. from outside the app).
          }
        },
      }
    : {};

  return (
    <div
      className={ownDropTarget ? (dropTarget ? "rounded-md outline-2 outline-accent outline-offset-1" : "") : ""}
      {...dropHandlers}
    >
      {actions.length === 0 && <div className="mb-3 text-xs text-text-muted">No actions assigned</div>}

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

      <div className="mb-2 flex flex-col gap-1.5">
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
    </div>
  );
}

const JOG_NUMBER_CLASS =
  "w-20 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text focus:border-accent focus:outline-none";

interface JogWheelPanelProps {
  obsStatus: ObsStatus;
  jogWheelMappings: JogWheelMappings;
  onAddJogAction: (trigger: Trigger, action: Action) => void;
  onRemoveJogAction: (trigger: Trigger, index: number) => void;
  onUpdateJogAction: (trigger: Trigger, index: number, action: Action) => void;
  onUpdateJogConfig: (trigger: Trigger, patch: Partial<Pick<Mapping, "threshold" | "amount_per_tick">>) => void;
}

/** The wheel has no press/release of its own -- rotating it fires one of
 * three independent triggers instead, each configured and populated with
 * actions separately. */
function JogWheelPanel({
  obsStatus,
  jogWheelMappings,
  onAddJogAction,
  onRemoveJogAction,
  onUpdateJogAction,
  onUpdateJogConfig,
}: JogWheelPanelProps) {
  const sections: {
    trigger: Trigger;
    title: string;
    hint: string;
    mapping: Mapping | undefined;
    config: ReactNode;
  }[] = [
    {
      trigger: "jog_clockwise",
      title: "Clockwise",
      hint: "Fires once every N ticks turned clockwise.",
      mapping: jogWheelMappings.clockwise,
      config: (
        <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
          Threshold (ticks)
          <input
            type="number"
            min={1}
            step={1}
            className={JOG_NUMBER_CLASS}
            value={jogWheelMappings.clockwise?.threshold ?? 10}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 1) return;
              onUpdateJogConfig("jog_clockwise", { threshold: n });
            }}
          />
        </label>
      ),
    },
    {
      trigger: "jog_counter_clockwise",
      title: "Counter-clockwise",
      hint: "Fires once every N ticks turned counter-clockwise.",
      mapping: jogWheelMappings.counterClockwise,
      config: (
        <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
          Threshold (ticks)
          <input
            type="number"
            min={1}
            step={1}
            className={JOG_NUMBER_CLASS}
            value={jogWheelMappings.counterClockwise?.threshold ?? 10}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n) || n < 1) return;
              onUpdateJogConfig("jog_counter_clockwise", { threshold: n });
            }}
          />
        </label>
      ),
    },
    {
      trigger: "jog_continuous",
      title: "Continuous",
      hint: "Fires on every tick. For Source Volume (relative), each tick's delta is multiplied by this amount instead of using the action's own configured delta.",
      mapping: jogWheelMappings.continuous,
      config: (
        <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
          Amount / tick
          <input
            type="number"
            step={0.1}
            className={JOG_NUMBER_CLASS}
            value={jogWheelMappings.continuous?.amount_per_tick ?? 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onUpdateJogConfig("jog_continuous", { amount_per_tick: n });
            }}
          />
        </label>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {sections.map((s) => (
        <div key={s.trigger}>
          <div className="mb-1 text-xs font-medium tracking-wide text-text-muted uppercase">{s.title}</div>
          <p className="mb-2 text-[11px] leading-relaxed text-text-muted">{s.hint}</p>
          {s.config}
          <div className="mt-2">
            <AssignedActions
              actions={s.mapping?.actions ?? []}
              obsStatus={obsStatus}
              onAddAction={(action) => onAddJogAction(s.trigger, action)}
              onRemoveAction={(index) => onRemoveJogAction(s.trigger, index)}
              onUpdateAction={(index, action) => onUpdateJogAction(s.trigger, index, action)}
              ownDropTarget
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertiesPanel({
  control,
  actions,
  obsStatus,
  onAddAction,
  onRemoveAction,
  onUpdateAction,
  jogWheelMappings,
  onAddJogAction,
  onRemoveJogAction,
  onUpdateJogAction,
  onUpdateJogConfig,
}: PropertiesPanelProps) {
  const isJogWheel = control === JOG_WHEEL_CONTROL_ID;
  const [dropTarget, setDropTarget] = useState(false);

  return (
    <aside
      className={[
        "animate-chrome-in flex h-full w-72 shrink-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-float",
        dropTarget && "outline-2 outline-accent outline-offset-1",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(e) => {
        if (!control || isJogWheel) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropTarget(false);
        if (!control || isJogWheel) return;
        const payload = e.dataTransfer.getData("application/x-sped-action");
        if (!payload) return;
        try {
          onAddAction(JSON.parse(payload) as Action);
        } catch {
          // Ignore malformed drag payloads (e.g. from outside the app).
        }
      }}
    >
      {!control ? (
        <div className="text-xs text-text-muted">Select a control</div>
      ) : isJogWheel ? (
        <>
          <div className="mb-4 text-base font-semibold tracking-wide text-text">JOG WHEEL</div>
          <JogWheelPanel
            obsStatus={obsStatus}
            jogWheelMappings={jogWheelMappings}
            onAddJogAction={onAddJogAction}
            onRemoveJogAction={onRemoveJogAction}
            onUpdateJogAction={onUpdateJogAction}
            onUpdateJogConfig={onUpdateJogConfig}
          />
        </>
      ) : (
        <>
          <div className="mb-4 text-base font-semibold tracking-wide text-text">
            {controlDisplayName(control)}
          </div>

          <div className="mb-2 text-xs font-medium tracking-wide text-text-muted uppercase">
            Assigned actions
          </div>

          <AssignedActions
            actions={actions}
            obsStatus={obsStatus}
            onAddAction={onAddAction}
            onRemoveAction={onRemoveAction}
            onUpdateAction={onUpdateAction}
          />

          <p className="text-[11px] leading-relaxed text-text-muted">
            Drag an OBS action from the sidebar onto this control, or record a keyboard shortcut
            above.
          </p>
        </>
      )}
    </aside>
  );
}
