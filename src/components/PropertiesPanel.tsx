import { X } from "lucide-react";
import { useState } from "react";
import { ShortcutRecorder } from "../cscl-ui/inputs/ShortcutRecorder";
import { IconButton } from "../cscl-ui/primitives/IconButton";
import { actionCategory, actionLabel, comboStringToKeys, type Action, type ControlId } from "../types";

export interface PropertiesPanelProps {
  control: ControlId | null;
  actions: Action[];
  onAddAction: (action: Action) => void;
  onRemoveAction: (index: number) => void;
}

function controlDisplayName(id: ControlId): string {
  return id
    .split("-")
    .map((part) => part.toUpperCase())
    .join(" ");
}

export function PropertiesPanel({ control, actions, onAddAction, onRemoveAction }: PropertiesPanelProps) {
  const [recorderKey, setRecorderKey] = useState(0);

  return (
    <aside className="animate-chrome-in flex h-full w-72 shrink-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-float">
      {!control ? (
        <div className="text-xs text-text-muted">Select a control</div>
      ) : (
        <>
          <div className="mb-4 text-base font-bold tracking-wide text-text">
            {controlDisplayName(control)}
          </div>

          <div className="mb-2 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
            Assigned actions
          </div>

          {actions.length === 0 && (
            <div className="mb-3 text-xs text-text-muted">No actions assigned</div>
          )}

          <ul className="mb-3 flex flex-col gap-1.5">
            {actions.map((action, index) => (
              <li
                key={index}
                className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-2.5 py-2"
              >
                <div>
                  <div className="text-[10px] tracking-wide text-text-muted uppercase">
                    {actionCategory(action)}
                  </div>
                  <div className="text-[13px] font-semibold text-text">{actionLabel(action)}</div>
                </div>
                <IconButton
                  aria-label="Remove action"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAction(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
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
