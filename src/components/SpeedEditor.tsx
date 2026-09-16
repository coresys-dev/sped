import { useState } from "react";
import type { ControlId } from "../types";
import styles from "./SpeedEditor.module.css";

interface KeyDef {
  id: ControlId;
  label: React.ReactNode;
  sub?: string;
  extraClasses?: (keyof typeof styles)[];
  area: string;
}

const TRIM_KEYS: KeyDef[] = [
  { id: "in", label: "IN", sub: "CLR", extraClasses: ["light", "in"], area: "trim" },
  { id: "out", label: "OUT", sub: "CLR", extraClasses: ["light", "out"], area: "trim" },
  {
    id: "trim-in",
    label: (
      <>
        TRIM
        <br />
        IN
      </>
    ),
    extraClasses: ["cA", "row2"],
    area: "trim",
  },
  {
    id: "trim-out",
    label: (
      <>
        TRIM
        <br />
        OUT
      </>
    ),
    extraClasses: ["cB", "row2"],
    area: "trim",
  },
  { id: "roll", label: "ROLL", sub: "SLIDE", extraClasses: ["cC", "row2"], area: "trim" },
  {
    id: "slip-src",
    label: (
      <>
        SLIP
        <br />
        SRC
      </>
    ),
    extraClasses: ["cA", "row3"],
    area: "trim",
  },
  {
    id: "slip-dest",
    label: (
      <>
        SLIP
        <br />
        DEST
      </>
    ),
    extraClasses: ["cB", "row3"],
    area: "trim",
  },
  {
    id: "trans-dur",
    label: (
      <>
        TRANS
        <br />
        DUR
      </>
    ),
    sub: "SET",
    extraClasses: ["cC", "row3"],
    area: "trim",
  },
  { id: "cut", label: "CUT", extraClasses: ["cA", "row4"], area: "trim" },
  { id: "dis", label: "DIS", extraClasses: ["cB", "row4"], area: "trim" },
  {
    id: "smooth-cut",
    label: (
      <>
        SMTH
        <br />
        CUT
      </>
    ),
    extraClasses: ["cC", "row4"],
    area: "trim",
  },
];

const TRANSPORT_KEYS: KeyDef[] = [
  {
    id: "smart-insert",
    label: (
      <>
        SMART
        <br />
        INSRT
      </>
    ),
    area: "transport",
  },
  { id: "append", label: "APPND", sub: "CLIP", area: "transport" },
  {
    id: "ripple-owr",
    label: (
      <>
        RIPL
        <br />
        O/WR
      </>
    ),
    area: "transport",
  },
  {
    id: "close-up",
    label: (
      <>
        CLOSE
        <br />
        UP
      </>
    ),
    sub: "YPOS",
    area: "transport",
  },
  {
    id: "place-top",
    label: (
      <>
        PLACE
        <br />
        ON TOP
      </>
    ),
    sub: "CLIP",
    area: "transport",
  },
  {
    id: "source-owr",
    label: (
      <>
        SRC
        <br />
        O/WR
      </>
    ),
    area: "transport",
  },
];

const EDIT_KEYS: KeyDef[] = [
  { id: "esc", label: "ESC", sub: "UNDO", area: "edit" },
  {
    id: "sync-bin",
    label: (
      <>
        SYNC
        <br />
        BIN
      </>
    ),
    area: "edit",
  },
  {
    id: "audio-level",
    label: (
      <>
        AUDIO
        <br />
        LEVEL
      </>
    ),
    sub: "MARK",
    area: "edit",
  },
  {
    id: "full-view",
    label: (
      <>
        FULL
        <br />
        VIEW
      </>
    ),
    sub: "RVW",
    extraClasses: ["red"],
    area: "edit",
  },
  { id: "trans-title", label: "TRANS", sub: "TITLE", area: "edit" },
  { id: "split-move", label: "SPLIT", sub: "MOVE", area: "edit" },
  { id: "snap", label: "SNAP", sub: "≡", area: "edit" },
  {
    id: "ripple-delete",
    label: (
      <>
        RIPL
        <br />
        DEL
      </>
    ),
    area: "edit",
  },
];

const CAM_KEYS: KeyDef[] = [
  {
    id: "cam-7",
    label: (
      <>
        CAM
        <br />7
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-8",
    label: (
      <>
        CAM
        <br />8
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-9",
    label: (
      <>
        CAM
        <br />9
      </>
    ),
    area: "cam",
  },
  {
    id: "live-owr",
    label: (
      <>
        LIVE
        <br />
        O/WR
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-4",
    label: (
      <>
        CAM
        <br />4
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-5",
    label: (
      <>
        CAM
        <br />5
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-6",
    label: (
      <>
        CAM
        <br />6
      </>
    ),
    area: "cam",
  },
  {
    id: "video-only",
    label: (
      <>
        VIDEO
        <br />
        ONLY
      </>
    ),
    sub: "RND",
    area: "cam",
  },
  {
    id: "cam-1",
    label: (
      <>
        CAM
        <br />1
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-2",
    label: (
      <>
        CAM
        <br />2
      </>
    ),
    area: "cam",
  },
  {
    id: "cam-3",
    label: (
      <>
        CAM
        <br />3
      </>
    ),
    area: "cam",
  },
  {
    id: "audio-only",
    label: (
      <>
        AUDIO
        <br />
        ONLY
      </>
    ),
    area: "cam",
  },
  { id: "stop-play", label: "STOP/PLAY", extraClasses: ["stopPlay"], area: "cam" },
];

const SOURCE_TIMELINE_KEYS: KeyDef[] = [
  { id: "source", label: "SOURCE", area: "sourceTimeline" },
  { id: "timeline", label: "TIMELINE", area: "sourceTimeline" },
];

const SHUTTLE_KEYS: KeyDef[] = [
  { id: "shuttle", label: "SHTL", extraClasses: ["smallWhite"], area: "shuttle" },
  { id: "jog", label: "JOG", extraClasses: ["smallWhite"], area: "shuttle" },
  { id: "scroll", label: "SCRL", extraClasses: ["smallWhite"], area: "shuttle" },
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
   * deltas -- see `App.tsx`. Not reset between events, only the CSS
   * transform's visual angle wraps (mod 360 is unnecessary, `rotate()`
   * handles any magnitude). */
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

  const classes = [
    styles.key,
    ...(def.extraClasses ?? []).map((c) => styles[c]),
    selected && styles.selected,
    isPressed && styles.pressed,
    isAssigned && styles.assigned,
    dropTarget && styles.dropTarget,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
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
    >
      {def.label}
      {def.sub && <span className={styles.sub}>{def.sub}</span>}
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

  const renderGroup = (area: string) =>
    byArea(area).map((def) => (
      <Key
        key={def.id}
        def={def}
        selected={selected === def.id}
        isPressed={pressed.has(def.id)}
        isAssigned={assigned.has(def.id)}
        onSelect={onSelect}
        onDropAction={onDropAction}
      />
    ));

  return (
    <div className={styles.wrapper}>
      <div className={styles.device} role="group" aria-label="Speed Editor">
        <div className={styles.brand}>
          DAVINCI RESOLVE <strong>SPEED EDITOR</strong>
        </div>
        <div className={styles.brandSub}>Blackmagic</div>

        <div className={styles.transportCluster}>{renderGroup("transport")}</div>
        <div className={styles.editCluster}>{renderGroup("edit")}</div>
        <div className={styles.sourceTimeline}>{renderGroup("sourceTimeline")}</div>
        <div className={styles.shuttleRow}>{renderGroup("shuttle")}</div>
        <div className={styles.trimCluster}>{renderGroup("trim")}</div>
        <div className={styles.camCluster}>{renderGroup("cam")}</div>

        <div
          className={[styles.jogOuter, jogActive && styles.active].filter(Boolean).join(" ")}
          role="slider"
          aria-label="Jog / shuttle wheel"
          aria-valuenow={Math.round(jogAngle) % 360}
          title="Jog wheel"
        >
          <div className={styles.jogFace} style={{ transform: `rotate(${jogAngle}deg)` }}>
            <span className={styles.jogNotch} />
          </div>
        </div>
      </div>
    </div>
  );
}
