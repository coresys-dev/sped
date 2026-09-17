import { GripVertical, Settings } from "lucide-react";
import { OBS_STATUS_COLOR, obsStatusLabel, type ObsAction, type ObsStatus } from "../types";
import { IconButton } from "../cscl-ui/primitives/IconButton";

interface DraggableItemProps {
  label: string;
  payload: object;
}

function DraggableItem({ label, payload }: DraggableItemProps) {
  return (
    <div
      className="mb-1 flex cursor-grab items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-text transition-colors hover:border-accent active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-sped-action", JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      {label}
    </div>
  );
}

const SECTION_LABEL = "text-xs font-medium tracking-wide text-text-muted uppercase";

const OBS_FAMILY_ITEMS: { label: string; subcategory: string; payload: ObsAction }[] = [
  {
    label: "Recording Control",
    subcategory: "Transport",
    payload: { kind: "obs", op: "recording", mode: "toggle" },
  },
  {
    label: "Streaming Control",
    subcategory: "Transport",
    payload: { kind: "obs", op: "streaming", mode: "toggle" },
  },
  {
    label: "Virtual Camera",
    subcategory: "Transport",
    payload: { kind: "obs", op: "virtual_cam", mode: "toggle" },
  },
  {
    label: "Studio Mode",
    subcategory: "Transport",
    payload: { kind: "obs", op: "studio_mode", mode: "toggle" },
  },
  {
    label: "Source Mute",
    subcategory: "Sources",
    payload: { kind: "obs", op: "source_mute", source: "", mode: "toggle" },
  },
  {
    label: "Source Visibility",
    subcategory: "Sources",
    payload: { kind: "obs", op: "source_visibility", scene: "", source: "", mode: "toggle" },
  },
  {
    label: "Source Volume",
    subcategory: "Sources",
    payload: {
      kind: "obs",
      op: "source_volume",
      source: "",
      mode: { kind: "absolute", percent: 100 },
    },
  },
];

export interface ActionsSidebarProps {
  obsStatus: ObsStatus;
  onOpenSettings: () => void;
}

export function ActionsSidebar({ obsStatus, onOpenSettings }: ActionsSidebarProps) {
  const scenes = obsStatus.state === "connected" ? obsStatus.scenes : [];

  return (
    <aside className="animate-chrome-in flex h-full w-56 shrink-0 flex-col rounded-lg border border-border bg-surface shadow-float">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className={`mb-3 ${SECTION_LABEL}`}>Actions</div>

        <p className="mb-4 text-[11px] leading-relaxed text-text-muted">
          Keyboard shortcuts are assigned directly on a selected control's properties panel.
        </p>

        <section className="mb-4">
          <h3 className={`mb-1.5 ${SECTION_LABEL}`}>OBS Studio</h3>
          <div className="mb-1 text-[11px] text-text-muted">
            Status: <span className={OBS_STATUS_COLOR[obsStatus.state]}>{obsStatusLabel(obsStatus)}</span>
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
          {OBS_FAMILY_ITEMS.filter((item) => item.subcategory === "Transport").map((item) => (
            <DraggableItem key={item.label} label={item.label} payload={item.payload} />
          ))}
          <div className="mt-2 mb-1 text-[10px] tracking-wide text-text-muted uppercase">
            Sources
          </div>
          {OBS_FAMILY_ITEMS.filter((item) => item.subcategory === "Sources").map((item) => (
            <DraggableItem key={item.label} label={item.label} payload={item.payload} />
          ))}
        </section>

        <section className="mb-4">
          <h3 className={`mb-1.5 ${SECTION_LABEL}`}>System</h3>
          <div className="text-[11px] text-text-muted">Coming soon</div>
        </section>

        <section className="mb-4">
          <h3 className={`mb-1.5 ${SECTION_LABEL}`}>Media</h3>
          <div className="text-[11px] text-text-muted">Coming soon</div>
        </section>

        <section>
          <h3 className={`mb-1.5 ${SECTION_LABEL}`}>Applications</h3>
          <div className="text-[11px] text-text-muted">Coming soon</div>
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
