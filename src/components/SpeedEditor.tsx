import { useState, type CSSProperties, type ReactNode } from "react";
import type { ControlId } from "../types";

/**
 * One CSS grid for the whole device instead of several independently
 * absolute-positioned clusters. The grid's `aspect-ratio` is set so that
 * a "1 column track" is exactly as wide as "1 row track" is tall -- every
 * key spanning `N cols x N rows` is therefore a true square (CAM*, the
 * trim 3x3, SHTL/JOG/SCRL...) and every key spanning `N cols x M rows`
 * with N != M is a true rectangle in that exact ratio (IN/OUT and
 * SOURCE/TIMELINE at 3:2, STOP/PLAY at 8:2), with no per-cluster math.
 *
 * Column tracks: 6 (transport/trim) + 0.4 (gutter) + 8 (edit/cam) + 0.4
 * (gutter) + 6 (source-timeline/shuttle/jog) = 20.8fr
 * Row tracks: 4 (top band) + 0.5 (gutter) + 8 (bottom band) = 12.5fr
 * => container aspect-ratio = 20.8 / 12.5 for square unit cells.
 *
 * Physical positions are still the `claude/docs/speed-editor-layout.html`
 * reference (used only for relative proportions, not its visual style):
 * every key's grid placement below preserves which keys are square vs.
 * wide relative to their neighbors on the real hardware.
 */
const GRID_COLUMNS = "repeat(6, 1fr) 0.4fr repeat(8, 1fr) 0.4fr repeat(6, 1fr)";
const GRID_ROWS = "repeat(4, 1fr) 0.5fr repeat(8, 1fr)";
const GRID_ASPECT = "20.8 / 12.5";

interface KeyDef {
  id: ControlId;
  label: ReactNode;
  sub?: string;
  col: string;
  row: string;
}

const TRIM_KEYS: KeyDef[] = [
  { id: "in", label: "IN", sub: "CLR", col: "1 / span 3", row: "6 / span 2" },
  { id: "out", label: "OUT", sub: "CLR", col: "4 / span 3", row: "6 / span 2" },
  { id: "trim-in", label: <>TRIM IN</>, col: "1 / span 2", row: "8 / span 2" },
  { id: "trim-out", label: <>TRIM OUT</>, col: "3 / span 2", row: "8 / span 2" },
  { id: "roll", label: "ROLL", sub: "SLIDE", col: "5 / span 2", row: "8 / span 2" },
  { id: "slip-src", label: <>SLIP SRC</>, col: "1 / span 2", row: "10 / span 2" },
  { id: "slip-dest", label: <>SLIP DEST</>, col: "3 / span 2", row: "10 / span 2" },
  { id: "trans-dur", label: <>TRANS DUR</>, sub: "SET", col: "5 / span 2", row: "10 / span 2" },
  { id: "cut", label: "CUT", col: "1 / span 2", row: "12 / span 2" },
  { id: "dis", label: "DIS", col: "3 / span 2", row: "12 / span 2" },
  { id: "smooth-cut", label: <>SMTH CUT</>, col: "5 / span 2", row: "12 / span 2" },
];

const TRANSPORT_KEYS: KeyDef[] = [
  { id: "smart-insert", label: <>SMART INSRT</>, col: "1 / span 2", row: "1 / span 2" },
  { id: "append", label: "APPND", sub: "CLIP", col: "3 / span 2", row: "1 / span 2" },
  { id: "ripple-owr", label: <>RIPL O/WR</>, col: "5 / span 2", row: "1 / span 2" },
  { id: "close-up", label: <>CLOSE UP</>, sub: "YPOS", col: "1 / span 2", row: "3 / span 2" },
  { id: "place-top", label: <>PLACE ON TOP</>, sub: "CLIP", col: "3 / span 2", row: "3 / span 2" },
  { id: "source-owr", label: <>SRC O/WR</>, col: "5 / span 2", row: "3 / span 2" },
];

const EDIT_KEYS: KeyDef[] = [
  { id: "esc", label: "ESC", sub: "UNDO", col: "8 / span 2", row: "1 / span 2" },
  { id: "sync-bin", label: <>SYNC BIN</>, col: "10 / span 2", row: "1 / span 2" },
  { id: "audio-level", label: <>AUDIO LEVEL</>, sub: "MARK", col: "12 / span 2", row: "1 / span 2" },
  { id: "full-view", label: <>FULL VIEW</>, sub: "RVW", col: "14 / span 2", row: "1 / span 2" },
  { id: "trans-title", label: "TRANS", sub: "TITLE", col: "8 / span 2", row: "3 / span 2" },
  { id: "split-move", label: "SPLIT", sub: "MOVE", col: "10 / span 2", row: "3 / span 2" },
  { id: "snap", label: "SNAP", sub: "≡", col: "12 / span 2", row: "3 / span 2" },
  { id: "ripple-delete", label: <>RIPL DEL</>, col: "14 / span 2", row: "3 / span 2" },
];

const CAM_KEYS: KeyDef[] = [
  { id: "cam-7", label: "CAM 7", col: "8 / span 2", row: "6 / span 2" },
  { id: "cam-8", label: "CAM 8", col: "10 / span 2", row: "6 / span 2" },
  { id: "cam-9", label: "CAM 9", col: "12 / span 2", row: "6 / span 2" },
  { id: "live-owr", label: <>LIVE O/WR</>, col: "14 / span 2", row: "6 / span 2" },
  { id: "cam-4", label: "CAM 4", col: "8 / span 2", row: "8 / span 2" },
  { id: "cam-5", label: "CAM 5", col: "10 / span 2", row: "8 / span 2" },
  { id: "cam-6", label: "CAM 6", col: "12 / span 2", row: "8 / span 2" },
  { id: "video-only", label: <>VIDEO ONLY</>, sub: "RND", col: "14 / span 2", row: "8 / span 2" },
  { id: "cam-1", label: "CAM 1", col: "8 / span 2", row: "10 / span 2" },
  { id: "cam-2", label: "CAM 2", col: "10 / span 2", row: "10 / span 2" },
  { id: "cam-3", label: "CAM 3", col: "12 / span 2", row: "10 / span 2" },
  { id: "audio-only", label: <>AUDIO ONLY</>, col: "14 / span 2", row: "10 / span 2" },
  { id: "stop-play", label: "STOP / PLAY", col: "8 / span 8", row: "12 / span 2" },
];

const SOURCE_TIMELINE_KEYS: KeyDef[] = [
  { id: "source", label: "SOURCE", col: "17 / span 3", row: "1 / span 2" },
  { id: "timeline", label: "TIMELINE", col: "20 / span 3", row: "1 / span 2" },
];

const SHUTTLE_KEYS: KeyDef[] = [
  { id: "shuttle", label: "SHTL", col: "17 / span 2", row: "3 / span 2" },
  { id: "jog", label: "JOG", col: "19 / span 2", row: "3 / span 2" },
  { id: "scroll", label: "SCRL", col: "21 / span 2", row: "3 / span 2" },
];

const ALL_KEYS = [
  ...TRIM_KEYS,
  ...TRANSPORT_KEYS,
  ...EDIT_KEYS,
  ...CAM_KEYS,
  ...SOURCE_TIMELINE_KEYS,
  ...SHUTTLE_KEYS,
];

const JOG_WHEEL_AREA: CSSProperties = { gridColumn: "17 / span 6", gridRow: "6 / span 6" };

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
      style={{ gridColumn: def.col, gridRow: def.row }}
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
        "relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-1 text-center text-[10px] leading-tight font-medium tracking-wide text-text transition-all duration-150",
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
  return (
    <div className="w-full max-w-3xl rounded-lg border border-border bg-surface p-6 shadow-float">
      <div
        className="grid w-full gap-1.5 rounded-md border border-border bg-surface-raised p-1.5"
        style={{
          aspectRatio: GRID_ASPECT,
          gridTemplateColumns: GRID_COLUMNS,
          gridTemplateRows: GRID_ROWS,
        }}
        role="group"
        aria-label="Speed Editor"
      >
        {ALL_KEYS.map((def) => (
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

        <div
          className="grid place-items-center rounded-full border-2 transition-shadow duration-150"
          style={{
            ...JOG_WHEEL_AREA,
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
              className="absolute top-[8%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
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
