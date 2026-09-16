import { Settings } from "lucide-react";
import type { ObsStatus } from "../types";
import { IconButton } from "../cscl-ui/primitives/IconButton";

interface DraggableItemProps {
  label: string;
  payload: object;
  onActivate?: () => void;
}

function DraggableItem({ label, payload, onActivate }: DraggableItemProps) {
  return (
    <div
      className="mb-1 flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-text transition-colors hover:border-accent active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-sped-action", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={onActivate}
      role={onActivate ? "button" : undefined}
    >
      <span className="text-text-muted">⠿</span>
      {label}
    </div>
  );
}

const OBS_TRANSPORT_ITEMS: { label: string; op: string }[] = [
  { label: "Start Recording", op: "start_recording" },
  { label: "Stop Recording", op: "stop_recording" },
  { label: "Pause Recording", op: "pause_recording" },
  { label: "Resume Recording", op: "resume_recording" },
  { label: "Start Streaming", op: "start_streaming" },
  { label: "Stop Streaming", op: "stop_streaming" },
];

const OBS_STATUS_STYLE: Record<ObsStatus["state"], string> = {
  connected: "text-accent",
  connecting: "text-accent-2",
  error: "text-danger",
  disconnected: "text-text-muted",
};

export interface ActionsSidebarProps {
  obsStatus: ObsStatus;
  onOpenSettings: () => void;
}

export function ActionsSidebar({ obsStatus, onOpenSettings }: ActionsSidebarProps) {
  const scenes = obsStatus.state === "connected" ? obsStatus.scenes : [];

  return (
    <aside className="animate-chrome-in flex h-full w-56 shrink-0 flex-col rounded-lg border border-border bg-surface shadow-float">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
          Actions
        </div>

        <p className="mb-4 text-[11px] leading-relaxed text-text-muted">
          Keyboard shortcuts are assigned directly on a selected control's properties panel.
        </p>

        <section className="mb-4">
          <h3 className="mb-1.5 text-xs font-semibold text-text">OBS Studio</h3>
          <div className="mb-1 text-[10px] tracking-wide text-text-muted uppercase">
            Status:{" "}
            <span className={OBS_STATUS_STYLE[obsStatus.state]}>
              {obsStatus.state === "connected"
                ? "Connected"
                : obsStatus.state === "connecting"
                  ? "Connecting…"
                  : obsStatus.state === "error"
                    ? "Error"
                    : "Disconnected"}
            </span>
          </div>
          {scenes.length > 0 && (
            <>
              <div className="mt-2 mb-1 text-[10px] tracking-wide text-text-muted uppercase">
                Scenes
              </div>
              {scenes.map((scene) => (
                <DraggableItem
                  key={scene}
                  label={scene}
                  payload={{ kind: "obs", op: "switch_scene", scene }}
                />
              ))}
            </>
          )}
          <div className="mt-2 mb-1 text-[10px] tracking-wide text-text-muted uppercase">
            Transport
          </div>
          {OBS_TRANSPORT_ITEMS.map((item) => (
            <DraggableItem key={item.op} label={item.label} payload={{ kind: "obs", op: item.op }} />
          ))}
        </section>

        <section className="mb-4">
          <h3 className="mb-1.5 text-xs font-semibold text-text">System</h3>
          <div className="text-[11px] text-text-muted italic">Coming soon</div>
        </section>

        <section className="mb-4">
          <h3 className="mb-1.5 text-xs font-semibold text-text">Media</h3>
          <div className="text-[11px] text-text-muted italic">Coming soon</div>
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold text-text">Applications</h3>
          <div className="text-[11px] text-text-muted italic">Coming soon</div>
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-2">
        <span className="text-[11px] text-text-muted">Settings</span>
        <IconButton aria-label="Open settings" variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </IconButton>
      </div>
    </aside>
  );
}
