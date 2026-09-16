import { useCallback, useEffect, useMemo, useState } from "react";
import { api, onDeviceEvent } from "./api";
import { ActionsSidebar } from "./components/ActionsSidebar";
import { DevPanel } from "./components/DevPanel";
import { Header } from "./components/Header";
import { ObsSettingsModal } from "./components/ObsSettingsModal";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SpeedEditor } from "./components/SpeedEditor";
import type { Action, ControlEvent, ControlId, DeviceStatus, Mapping, ObsStatus, Profile } from "./types";
import "./App.css";

const DEV_MODE = import.meta.env.DEV;

export default function App() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [pressed, setPressed] = useState<Set<ControlId>>(new Set());
  const [jogSpinning, setJogSpinning] = useState(false);

  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfileName, setActiveProfileName] = useState<string>("");
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  const [selected, setSelected] = useState<ControlId | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsStatus>({ state: "disconnected" });
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [addKeyboardRequested, setAddKeyboardRequested] = useState(false);

  const [devPanelOpen, setDevPanelOpen] = useState(DEV_MODE);
  const [eventLog, setEventLog] = useState<{ time: string; event: ControlEvent }[]>([]);

  const refreshProfiles = useCallback(async () => {
    const [names, activeName, active] = await Promise.all([
      api.listProfiles(),
      api.getActiveProfileName(),
      api.getActiveProfile(),
    ]);
    setProfiles(names);
    setActiveProfileName(activeName);
    setActiveProfile(active);
  }, []);

  useEffect(() => {
    api.getDeviceStatus().then(setDeviceStatus).catch(() => {});
    refreshProfiles();

    let jogTimeout: ReturnType<typeof setTimeout> | undefined;

    const unlisten = onDeviceEvent((event) => {
      setEventLog((prev) => [
        { time: new Date().toLocaleTimeString(), event },
        ...prev.slice(0, 49),
      ]);

      switch (event.type) {
        case "connected":
          setDeviceStatus((s) => ({ connected: true, mock: s?.mock ?? false }));
          break;
        case "disconnected":
          setDeviceStatus((s) => ({ connected: false, mock: s?.mock ?? false }));
          break;
        case "pressed":
          setPressed((prev) => new Set(prev).add(event.control));
          break;
        case "released":
          setPressed((prev) => {
            const next = new Set(prev);
            next.delete(event.control);
            return next;
          });
          break;
        case "jog":
        case "shuttle":
          setJogSpinning(true);
          if (jogTimeout) clearTimeout(jogTimeout);
          jogTimeout = setTimeout(() => setJogSpinning(false), 200);
          break;
      }
    });

    const pollObs = () => api.obsStatus().then(setObsStatus).catch(() => {});
    pollObs();
    const interval = setInterval(pollObs, 2000);

    return () => {
      unlisten.then((u) => u());
      clearInterval(interval);
      if (jogTimeout) clearTimeout(jogTimeout);
    };
  }, [refreshProfiles]);

  const mappingsForSelected: Mapping[] = useMemo(() => {
    if (!selected || !activeProfile) return [];
    return activeProfile.mappings[selected] ?? [];
  }, [selected, activeProfile]);

  const primaryMapping = mappingsForSelected.find(
    (m) => m.trigger === "press" && m.modifier === "none",
  );
  const actionsForSelected = primaryMapping?.actions ?? [];

  const assignedControls = useMemo(() => {
    const set = new Set<ControlId>();
    if (activeProfile) {
      for (const [control, mappings] of Object.entries(activeProfile.mappings)) {
        if (mappings.some((m) => m.actions.length > 0)) set.add(control);
      }
    }
    return set;
  }, [activeProfile]);

  const saveMappingsForControl = useCallback(
    async (control: ControlId, mappings: Mapping[]) => {
      await api.setMapping(control, mappings);
      await refreshProfiles();
    },
    [refreshProfiles],
  );

  const addActionToControl = useCallback(
    async (control: ControlId, action: Action) => {
      const profile = await api.getActiveProfile();
      const existing = profile.mappings[control] ?? [];
      const others = existing.filter((m) => !(m.trigger === "press" && m.modifier === "none"));
      const current = existing.find((m) => m.trigger === "press" && m.modifier === "none");
      const updated: Mapping = current
        ? { ...current, actions: [...current.actions, action] }
        : { trigger: "press", modifier: "none", actions: [action] };
      await saveMappingsForControl(control, [...others, updated]);
    },
    [saveMappingsForControl],
  );

  const removeActionFromControl = useCallback(
    async (control: ControlId, index: number) => {
      const profile = await api.getActiveProfile();
      const existing = profile.mappings[control] ?? [];
      const others = existing.filter((m) => !(m.trigger === "press" && m.modifier === "none"));
      const current = existing.find((m) => m.trigger === "press" && m.modifier === "none");
      if (!current) return;
      const nextActions = current.actions.filter((_, i) => i !== index);
      const updated = nextActions.length > 0 ? [{ ...current, actions: nextActions }] : [];
      await saveMappingsForControl(control, [...others, ...updated]);
    },
    [saveMappingsForControl],
  );

  const handleDropAction = useCallback(
    (control: ControlId, payload: string) => {
      try {
        const action = JSON.parse(payload) as Action;
        addActionToControl(control, action);
      } catch {
        // Ignore malformed drag payloads (e.g. from outside the app).
      }
    },
    [addActionToControl],
  );

  return (
    <div className="app">
      <Header
        deviceStatus={deviceStatus}
        onOpenObsSettings={() => setObsModalOpen(true)}
        profileManager={{
          profiles,
          activeProfile: activeProfileName,
          onSelect: async (name) => {
            await api.selectProfile(name);
            await refreshProfiles();
          },
          onCreate: async (name) => {
            await api.createProfile(name);
            await api.selectProfile(name);
            await refreshProfiles();
          },
          onDuplicate: async (name) => {
            await api.duplicateProfile(activeProfileName, name);
            await api.selectProfile(name);
            await refreshProfiles();
          },
          onRename: async (name) => {
            await api.renameProfile(activeProfileName, name);
            await refreshProfiles();
          },
          onDelete: async () => {
            await api.deleteProfile(activeProfileName);
            await refreshProfiles();
          },
          onExport: async () => {
            const json = await api.exportProfile(activeProfileName);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${activeProfileName}.json`;
            a.click();
            URL.revokeObjectURL(url);
          },
          onImport: async (json) => {
            const name = await api.importProfile(json);
            await api.selectProfile(name);
            await refreshProfiles();
          },
        }}
      />

      <div className="body">
        <ActionsSidebar
          obsStatus={obsStatus}
          onCustomKeyboard={() => {
            if (selected) setAddKeyboardRequested(true);
          }}
        />

        <main className="center">
          <SpeedEditor
            selected={selected}
            pressed={pressed}
            assigned={assignedControls}
            jogSpinning={jogSpinning}
            onSelect={setSelected}
            onDropAction={handleDropAction}
          />
        </main>

        <PropertiesPanel
          control={selected}
          actions={actionsForSelected}
          onAddAction={(action) => selected && addActionToControl(selected, action)}
          onRemoveAction={(index) => selected && removeActionFromControl(selected, index)}
          addKeyboardRequested={addKeyboardRequested}
          onAddKeyboardHandled={() => setAddKeyboardRequested(false)}
        />
      </div>

      {obsModalOpen && (
        <ObsSettingsModal
          status={obsStatus}
          onConnect={(host, port, password) => api.obsConnect(host, port, password)}
          onDisconnect={() => api.obsDisconnect()}
          onClose={() => setObsModalOpen(false)}
        />
      )}

      {devPanelOpen && (
        <DevPanel
          deviceStatus={deviceStatus}
          log={eventLog}
          onClose={() => setDevPanelOpen(false)}
        />
      )}
    </div>
  );
}
