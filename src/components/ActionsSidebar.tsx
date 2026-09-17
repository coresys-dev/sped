import { GripVertical, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  OBS_STATUS_COLOR,
  obsStatusLabel,
  type DeviceStatus,
  type ObsAction,
  type ObsStatus,
} from "../types";

interface DraggableItemProps {
  label: string;
  payload: object;
  breadcrumb?: string;
}

function DraggableItem({ label, payload, breadcrumb }: DraggableItemProps) {
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
      <div className="min-w-0 flex-1">
        <div className="truncate">{label}</div>
        {breadcrumb && <div className="truncate text-[10px] text-text-muted">{breadcrumb}</div>}
      </div>
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
      mode: { kind: "absolute", value: 100, unit: "percent" },
    },
  },
];

export interface ActionsSidebarProps {
  obsStatus: ObsStatus;
  deviceStatus: DeviceStatus | null;
}

interface ActionEntry {
  label: string;
  payload: object;
  category: string;
  subcategory: string;
}

export function ActionsSidebar({ obsStatus, deviceStatus }: ActionsSidebarProps) {
  const [query, setQuery] = useState("");
  const scenes = obsStatus.state === "connected" ? obsStatus.scenes : [];
  const connected = deviceStatus?.connected ?? false;

  const allEntries = useMemo<ActionEntry[]>(() => {
    const entries: ActionEntry[] = [];
    for (const scene of scenes) {
      entries.push({
        label: scene,
        payload: { kind: "obs", op: "switch_scene", scene },
        category: "OBS Studio",
        subcategory: "Scenes",
      });
    }
    for (const item of OBS_FAMILY_ITEMS) {
      entries.push({
        label: item.label,
        payload: item.payload,
        category: "OBS Studio",
        subcategory: item.subcategory,
      });
    }
    return entries;
  }, [scenes]);

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!trimmedQuery) return [];
    return allEntries.filter((entry) => entry.label.toLowerCase().includes(trimmedQuery));
  }, [allEntries, trimmedQuery]);

  return (
    <aside className="animate-chrome-in flex h-full w-56 shrink-0 flex-col rounded-lg border border-border bg-surface shadow-float">
      <div className="flex shrink-0 flex-col gap-0.5 border-b border-border px-3 py-2.5">
        <div className="truncate text-xs font-semibold tracking-wide text-text">Speed Editor Control</div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-accent" : "bg-surface-hover"}`}
            style={connected ? { boxShadow: "0 0 6px var(--color-accent)" } : undefined}
          />
          <span>
            {deviceStatus?.mock ? "Mock — " : ""}
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className={`mb-3 ${SECTION_LABEL}`}>Actions</div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions…"
            className="w-full rounded-md border border-border bg-surface-raised py-1.5 pr-7 pl-7 text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {trimmedQuery ? (
          <section>
            {searchResults.length === 0 ? (
              <div className="text-[11px] text-text-muted">No actions match "{query}"</div>
            ) : (
              searchResults.map((entry, i) => (
                <DraggableItem
                  key={`${entry.category}-${entry.subcategory}-${entry.label}-${i}`}
                  label={entry.label}
                  payload={entry.payload}
                  breadcrumb={`${entry.category} / ${entry.subcategory}`}
                />
              ))
            )}
          </section>
        ) : (
          <>
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
          </>
        )}
      </div>
    </aside>
  );
}
