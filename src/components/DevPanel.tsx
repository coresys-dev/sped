import { X } from "lucide-react";
import { api } from "../api";
import { Chip } from "../cscl-ui/primitives/Chip";
import { IconButton } from "../cscl-ui/primitives/IconButton";
import type { ControlEvent, DeviceStatus, LedId } from "../types";

export interface DevPanelProps {
  deviceStatus: DeviceStatus | null;
  log: { time: string; event: ControlEvent }[];
  litLeds: Set<LedId>;
  onToggleLed: (id: LedId, on: boolean) => void;
  onClearLeds: () => void;
  onClose: () => void;
}

const MOCK_CONTROLS = ["cut", "cam-1", "cam-2", "cam-3", "stop-play"];
const LED_TEST_IDS: LedId[] = ["cam-1", "cam-2", "cam-3", "cut", "dis", "smth-cut"];

function describe(event: ControlEvent): string {
  switch (event.type) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "pressed":
      return `${event.control.toUpperCase()}  Pressed`;
    case "released":
      return `${event.control.toUpperCase()}  Released`;
    case "jog":
      return `JOG  ${event.delta > 0 ? "+" : ""}${event.delta}`;
    case "shuttle":
      return `SHTL  ${event.value}`;
  }
}

export function DevPanel({ deviceStatus, log, litLeds, onToggleLed, onClearLeds, onClose }: DevPanelProps) {
  const mockActive = deviceStatus?.mock ?? false;

  return (
    <div className="animate-chrome-in fixed right-4 bottom-4 z-40 flex max-h-[26rem] w-80 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-float">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5 text-xs font-medium tracking-wide text-text-muted uppercase">
        <span>Speed Editor Events</span>
        <IconButton aria-label="Close event log" variant="ghost" size="sm" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {mockActive ? (
        <div className="m-2 flex flex-wrap gap-1 rounded-md border border-border bg-surface-raised p-1">
          {MOCK_CONTROLS.map((id) => (
            <Chip key={id} active={false} onClick={() => api.mockSend({ action: "tap", value: id })}>
              {id}
            </Chip>
          ))}
          <Chip active={false} onClick={() => api.mockSend({ action: "jog", value: 1 })}>
            Jog +
          </Chip>
          <Chip active={false} onClick={() => api.mockSend({ action: "jog", value: -1 })}>
            Jog -
          </Chip>
        </div>
      ) : (
        <>
          <div className="border-b border-border p-2 text-[11px] text-text-muted">
            Set SPED_MOCK=1 and restart to enable mock controls.
          </div>
          <div className="border-b border-border p-2">
            <div className="mb-1 text-[10px] tracking-wide text-text-muted uppercase">
              LED test (real hardware only)
            </div>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface-raised p-1">
              {LED_TEST_IDS.map((led) => (
                <Chip key={led} active={litLeds.has(led)} onClick={() => onToggleLed(led, !litLeds.has(led))}>
                  {led}
                </Chip>
              ))}
              <Chip active={false} onClick={onClearLeds}>
                Clear
              </Chip>
            </div>
          </div>
        </>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5 font-mono text-[11px]">
        {log.map((entry, i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <span className="text-text-muted">{entry.time}</span>
            <span className="text-text">{describe(entry.event)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
