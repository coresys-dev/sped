import { useState, type CSSProperties, type ReactNode } from "react";
import type { ControlId } from "../types";

/**
 * Physical layout reference only: `claude/docs/speed-editor-layout.html`
 * (percent-based cluster positions/spans, copied here as plain numbers) --
 * the visual language below is this app's own flat, token-driven design,
 * not a reproduction of that file's fake-hardware gradients/plastic keys.
 */

interface ClusterDef {
  area: string;
  style: CSSProperties;
  cols: number;
  rows: number;
}

const CLUSTERS: ClusterDef[] = [
  { area: "transport", style: { left: "4.3%", top: "15.6%", width: "25.4%", height: "23.4%" }, cols: 3, rows: 2 },
  { area: "edit", style: { left: "37.4%", top: "15.6%", width: "30.7%", height: "23.4%" }, cols: 4, rows: 2 },
  {
    area: "sourceTimeline",
    style: { left: "73.7%", top: "15.1%", width: "22.3%", height: "13%" },
    cols: 2,
    rows: 1,
  },
  { area: "shuttle", style: { left: "73.7%", top: "33.9%", width: "22.3%", height: "10.4%" }, cols: 3, rows: 1 },
  { area: "trim", style: { left: "4.3%", top: "43.7%", width: "25.4%", height: "47.4%" }, cols: 6, rows: 4 },
  { area: "cam", style: { left: "35.2%", top: "43.7%", width: "32.9%", height: "47.4%" }, cols: 4, rows: 4 },
];

interface KeyDef {
  id: ControlId;
  label: ReactNode;
  sub?: string;
  area: string;
  span?: CSSProperties;
}

const TRIM_KEYS: KeyDef[] = [
  { id: "in", label: "IN", sub: "CLR", area: "trim", span: { gridColumn: "1 / span 3", gridRow: 1 } },
  { id: "out", label: "OUT", sub: "CLR", area: "trim", span: { gridColumn: "4 / span 3", gridRow: 1 } },
  { id: "trim-in", label: <>TRIM IN</>, area: "trim", span: { gridColumn: "1 / span 2", gridRow: 2 } },
  { id: "trim-out", label: <>TRIM OUT</>, area: "trim", span: { gridColumn: "3 / span 2", gridRow: 2 } },
  { id: "roll", label: "ROLL", sub: "SLIDE", area: "trim", span: { gridColumn: "5 / span 2", gridRow: 2 } },
  { id: "slip-src", label: <>SLIP SRC</>, area: "trim", span: { gridColumn: "1 / span 2", gridRow: 3 } },
  { id: "slip-dest", label: <>SLIP DEST</>, area: "trim", span: { gridColumn: "3 / span 2", gridRow: 3 } },
  { id: "trans-dur", label: <>TRANS DUR</>, sub: "SET", area: "trim", span: { gridColumn: "5 / span 2", gridRow: 3 } },
  { id: "cut", label: "CUT", area: "trim", span: { gridColumn: "1 / span 2", gridRow: 4 } },
  { id: "dis", label: "DIS", area: "trim", span: { gridColumn: "3 / span 2", gridRow: 4 } },
  { id: "smooth-cut", label: <>SMTH CUT</>, area: "trim", span: { gridColumn: "5 / span 2", gridRow: 4 } },
];

const TRANSPORT_KEYS: KeyDef[] = [
  { id: "smart-insert", label: <>SMART INSRT</>, area: "transport" },
  { id: "append", label: "APPND", sub: "CLIP", area: "transport" },
  { id: "ripple-owr", label: <>RIPL O/WR</>, area: "transport" },
  { id: "close-up", label: <>CLOSE UP</>, sub: "YPOS", area: "transport" },
  { id: "place-top", label: <>PLACE ON TOP</>, sub: "CLIP", area: "transport" },
  { id: "source-owr", label: <>SRC O/WR</>, area: "transport" },
];

const EDIT_KEYS: KeyDef[] = [
  { id: "esc", label: "ESC", sub: "UNDO", area: "edit" },
  { id: "sync-bin", label: <>SYNC BIN</>, area: "edit" },
  { id: "audio-level", label: <>AUDIO LEVEL</>, sub: "MARK", area: "edit" },
  { id: "full-view", label: <>FULL VIEW</>, sub: "RVW", area: "edit" },
  { id: "trans-title", label: "TRANS", sub: "TITLE", area: "edit" },
  { id: "split-move", label: "SPLIT", sub: "MOVE", area: "edit" },
  { id: "snap", label: "SNAP", sub: "≡", area: "edit" },
  { id: "ripple-delete", label: <>RIPL DEL</>, area: "edit" },
];

const CAM_KEYS: KeyDef[] = [
  { id: "cam-7", label: "CAM 7", area: "cam", span: { gridColumn: 1, gridRow: 1 } },
  { id: "cam-8", label: "CAM 8", area: "cam", span: { gridColumn: 2, gridRow: 1 } },
  { id: "cam-9", label: "CAM 9", area: "cam", span: { gridColumn: 3, gridRow: 1 } },
  { id: "live-owr", label: <>LIVE O/WR</>, area: "cam", span: { gridColumn: 4, gridRow: 1 } },
  { id: "cam-4", label: "CAM 4", area: "cam", span: { gridColumn: 1, gridRow: 2 } },
  { id: "cam-5", label: "CAM 5", area: "cam", span: { gridColumn: 2, gridRow: 2 } },
  { id: "cam-6", label: "CAM 6", area: "cam", span: { gridColumn: 3, gridRow: 2 } },
  { id: "video-only", label: <>VIDEO ONLY</>, sub: "RND", area: "cam", span: { gridColumn: 4, gridRow: 2 } },
  { id: "cam-1", label: "CAM 1", area: "cam", span: { gridColumn: 1, gridRow: 3 } },
  { id: "cam-2", label: "CAM 2", area: "cam", span: { gridColumn: 2, gridRow: 3 } },
  { id: "cam-3", label: "CAM 3", area: "cam", span: { gridColumn: 3, gridRow: 3 } },
  { id: "audio-only", label: <>AUDIO ONLY</>, area: "cam", span: { gridColumn: 4, gridRow: 3 } },
  { id: "stop-play", label: "STOP / PLAY", area: "cam", span: { gridColumn: "1 / span 4", gridRow: 4 } },
];

const SOURCE_TIMELINE_KEYS: KeyDef[] = [
  { id: "source", label: "SOURCE", area: "sourceTimeline" },
  { id: "timeline", label: "TIMELINE", area: "sourceTimeline" },
];

const SHUTTLE_KEYS: KeyDef[] = [
  { id: "shuttle", label: "SHTL", area: "shuttle" },
  { id: "jog", label: "JOG", area: "shuttle" },
  { id: "scroll", label: "SCRL", area: "shuttle" },
];

const ALL_KEYS = [
  ...TRIM_KEYS,
  ...TRANSPORT_KEYS,
  ...EDIT_KEYS,
  ...CAM_KEYS,
  ...SOURCE_TIMELINE_KEYS,
  ...SHUTTLE_KEYS,
];

export interface SpeedEditorProps {
  selected: ControlId | null;
  pressed: Set<ControlId>;
  assigned: Set<ControlId>;
  /** Cumulative wheel rotation in degrees, driven by real jog/shuttle
   * deltas -- see `App.tsx`. `rotate()` handles any magnitude, no need to
   * wrap this mod 360. */
  jogAngle: number;
  jogActive: boolean;
  onSelect: (control: ControlId) => void;
  onDropAction?: (control: ControlId, payload: string) => void;
}

function Key({
  def,
  selected,
  isPressed,
  isAssigned,
  onSelect,
  onDropAction,
}: {
  def: KeyDef;
  selected: boolean;
  isPressed: boolean;
  isAssigned: boolean;
  onSelect: (control: ControlId) => void;
  onDropAction?: (control: ControlId, payload: string) => void;
}) {
  const [dropTarget, setDropTarget] = useState(false);

  return (
    <button
      type="button"
      style={def.span}
      data-control={def.id}
      aria-pressed={selected}
      aria-label={typeof def.label === "string" ? def.label : def.id}
      onClick={() => onSelect(def.id)}
      onDragOver={(e) => {
        e.preventDefault();
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropTarget(false);
        const payload = e.dataTransfer.getData("application/x-sped-action");
        if (payload && onDropAction) onDropAction(def.id, payload);
      }}
      className={[
        "relative flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-center text-[10px] leading-tight font-semibold tracking-wide text-text transition-all duration-150",
        selected
          ? "border-accent/40 bg-accent-muted text-accent"
          : isPressed
            ? "scale-95 border-accent/40 bg-accent-muted text-accent"
            : "border-border bg-surface-raised hover:bg-surface-hover active:scale-95",
        dropTarget && "outline-2 outline-accent outline-offset-1",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {def.label}
      {def.sub && <span className="text-[9px] font-medium text-text-muted">{def.sub}</span>}
      {isAssigned && (
        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      )}
    </button>
  );
}

export function SpeedEditor({
  selected,
  pressed,
  assigned,
  jogAngle,
  jogActive,
  onSelect,
  onDropAction,
}: SpeedEditorProps) {
  const byArea = (area: string) => ALL_KEYS.filter((k) => k.area === area);

  return (
    <div className="w-full max-w-3xl rounded-lg border border-border bg-surface p-6 shadow-float">
      <div
        className="relative aspect-[1.4216/1] min-h-[300px] w-full rounded-md border border-border bg-surface-raised"
        role="group"
        aria-label="Speed Editor"
      >
        {CLUSTERS.map((cluster) => (
          <div
            key={cluster.area}
            className="absolute grid gap-1.5"
            style={{
              ...cluster.style,
              gridTemplateColumns: `repeat(${cluster.cols}, 1fr)`,
              gridTemplateRows: `repeat(${cluster.rows}, 1fr)`,
            }}
          >
            {byArea(cluster.area).map((def) => (
              <Key
                key={def.id}
                def={def}
                selected={selected === def.id}
                isPressed={pressed.has(def.id)}
                isAssigned={assigned.has(def.id)}
                onSelect={onSelect}
                onDropAction={onDropAction}
              />
            ))}
          </div>
        ))}

        <div
          className="absolute grid place-items-center rounded-full border-2 transition-shadow duration-150"
          style={{
            left: "73.7%",
            top: "48%",
            width: "22.3%",
            aspectRatio: "1",
            borderColor: jogActive ? "var(--color-accent)" : "var(--color-border)",
            boxShadow: jogActive ? "0 0 16px -2px var(--color-accent)" : undefined,
            background: "var(--color-surface-hover)",
          }}
          role="slider"
          aria-label="Jog / shuttle wheel"
          aria-valuenow={Math.round(jogAngle) % 360}
          title="Jog wheel"
        >
          <div
            className="relative h-full w-full rounded-full"
            style={{ transform: `rotate(${jogAngle}deg)`, transition: "transform 80ms linear" }}
          >
            <span
              className="absolute top-[10%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ background: jogActive ? "var(--color-accent)" : "var(--color-text-muted)" }}
            />
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-text-muted">
        Blackmagic Design DaVinci Resolve Speed Editor — physical layout reference
      </p>
    </div>
  );
}
