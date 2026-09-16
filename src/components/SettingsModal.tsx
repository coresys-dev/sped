import { RotateCw, SlidersHorizontal, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Button } from "../cscl-ui/primitives/Button";
import { Switch } from "../cscl-ui/primitives/Switch";
import { Slider } from "../cscl-ui/primitives/Slider";
import {
  SidebarTabsDialog,
  SidebarTabsDialogRow,
} from "../cscl-ui/navigation/SidebarTabsDialog";
import type { AppSettings, ObsStatus } from "../types";

export interface SettingsModalProps {
  obsStatus: ObsStatus;
  onObsConnect: (host: string, port: number, password?: string) => void;
  onObsDisconnect: () => void;
  onClose: () => void;
}

const TABS = [
  { id: "obs", icon: Video, label: "OBS Studio" },
  { id: "device", icon: RotateCw, label: "Device" },
  { id: "general", icon: SlidersHorizontal, label: "General" },
];

export function SettingsModal({ obsStatus, onObsConnect, onObsDisconnect, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState("obs");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [password, setPassword] = useState("");
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.hasObsPassword().then(setHasStoredPassword);
  }, []);

  const patch = (next: AppSettings) => {
    setSettings(next);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      api.setSettings(next);
    }, 250);
  };

  if (!settings) return null;

  return (
    <SidebarTabsDialog
      title="Settings"
      tabs={TABS}
      activeTabId={tab}
      onSelectTab={setTab}
      onClose={onClose}
      closeLabel="Close settings"
    >
      {tab === "obs" && (
        <div className="flex flex-col gap-4">
          <SidebarTabsDialogRow label="Host">
            <input
              className="w-40 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
              value={settings.obs.host}
              onChange={(e) => patch({ ...settings, obs: { ...settings.obs, host: e.target.value } })}
            />
          </SidebarTabsDialogRow>

          <SidebarTabsDialogRow label="Port">
            <input
              type="number"
              className="w-24 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
              value={settings.obs.port}
              onChange={(e) =>
                patch({ ...settings, obs: { ...settings.obs, port: Number(e.target.value) } })
              }
            />
          </SidebarTabsDialogRow>

          <SidebarTabsDialogRow label={hasStoredPassword ? "Password (stored)" : "Password"}>
            <div className="flex gap-1.5">
              <input
                type="password"
                placeholder={hasStoredPassword ? "••••••••" : "(optional)"}
                className="w-32 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={!password}
                onClick={async () => {
                  await api.setObsPassword(password);
                  setPassword("");
                  setHasStoredPassword(true);
                }}
              >
                Save
              </Button>
            </div>
          </SidebarTabsDialogRow>

          <SidebarTabsDialogRow label="Connect automatically at startup">
            <Switch
              checked={settings.obs.autoconnect}
              label="Connect automatically at startup"
              onChange={(autoconnect) => patch({ ...settings, obs: { ...settings.obs, autoconnect } })}
            />
          </SidebarTabsDialogRow>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-text-muted">
              Status: <strong className="text-text">{obsStatus.state}</strong>
              {obsStatus.state === "error" && (
                <span className="block text-[11px] text-danger">{obsStatus.message}</span>
              )}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onObsDisconnect}>
                Disconnect
              </Button>
              <Button
                size="sm"
                onClick={() => onObsConnect(settings.obs.host, settings.obs.port, password || undefined)}
              >
                Connect
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "device" && (
        <div className="flex flex-col gap-4">
          <SidebarTabsDialogRow label={`Jog / shuttle sensitivity (${settings.jog.sensitivity.toFixed(2)}×)`}>
            <Slider
              value={settings.jog.sensitivity}
              min={0.05}
              max={3}
              step={0.05}
              ariaLabel="Jog and shuttle sensitivity"
              onChange={(sensitivity) => patch({ ...settings, jog: { ...settings.jog, sensitivity } })}
            />
          </SidebarTabsDialogRow>

          <SidebarTabsDialogRow label={`Deadzone (${settings.jog.deadzone} tick${settings.jog.deadzone === 1 ? "" : "s"})`}>
            <Slider
              value={settings.jog.deadzone}
              min={0}
              max={10}
              step={1}
              ariaLabel="Jog and shuttle deadzone"
              onChange={(deadzone) => patch({ ...settings, jog: { ...settings.jog, deadzone } })}
            />
          </SidebarTabsDialogRow>

          <SidebarTabsDialogRow label="Invert wheel direction">
            <Switch
              checked={settings.jog.invert}
              label="Invert wheel direction"
              onChange={(invert) => patch({ ...settings, jog: { ...settings.jog, invert } })}
            />
          </SidebarTabsDialogRow>

          <p className="text-[11px] leading-relaxed text-text-muted">
            Sensitivity scales raw jog/shuttle deltas from the device before they reach the
            visualizer and the mapping engine. Movements at or below the deadzone are ignored
            entirely, to absorb the wheel's smallest, likely-unintentional nudges.
          </p>
        </div>
      )}

      {tab === "general" && (
        <div className="flex flex-col gap-4">
          <SidebarTabsDialogRow label="Show developer event log">
            <Switch
              checked={settings.general.debugOverlay}
              label="Show developer event log"
              onChange={(debugOverlay) =>
                patch({ ...settings, general: { ...settings.general, debugOverlay } })
              }
            />
          </SidebarTabsDialogRow>
        </div>
      )}
    </SidebarTabsDialog>
  );
}
