import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, onDeviceEvent } from "./api";
import { ActionsSidebar } from "./components/ActionsSidebar";
import { AppTitleBar } from "./components/AppTitleBar";
import { DevPanel } from "./components/DevPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SettingsModal } from "./components/SettingsModal";
import { SpeedEditor } from "./components/SpeedEditor";
import type {
  Action,
  ControlEvent,
  ControlId,
  DeviceStatus,
  Mapping,
  ObsStatus,
  Profile,
} from "./types";

const DEV_MODE = import.meta.env.DEV;
/** Degrees of visual rotation per unit of (sensitivity-scaled) jog delta.
 * Purely a feel constant for the visualizer, not a hardware value. */
const DEGREES_PER_JOG_UNIT = 6;

export default function App() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [pressed, setPressed] = useState<Set<ControlId>>(new Set());
  const [jogAngle, setJogAngle] = useState(0);
  const [jogActive, setJogActive] = useState(false);

  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfileName, setActiveProfileName] = useState<string>("");
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  const [selected, setSelected] = useState<ControlId | null>(null);
  const [obsStatus, setObsStatus] = useState<ObsStatus>({ state: "disconnected" });
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    api
      .getSettings()
      .then((s) => setDevPanelOpen((open) => open || s.general.debugOverlay))
      .catch(() => {});
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
          setJogAngle((a) => a + event.delta * DEGREES_PER_JOG_UNIT);
          setJogActive(true);
          if (jogTimeout) clearTimeout(jogTimeout);
          jogTimeout = setTimeout(() => setJogActive(false), 250);
          break;
        case "shuttle":
          setJogAngle((a) => a + event.value * DEGREES_PER_JOG_UNIT * 0.2);
          setJogActive(true);
          if (jogTimeout) clearTimeout(jogTimeout);
          jogTimeout = setTimeout(() => setJogActive(false), 250);
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

  // Rapid-fire edits (e.g. typing in a number input) would otherwise each
  // trigger an independent read-modify-write disk round-trip, and
  // overlapping calls can clobber each other's writes. Debounce so only
  // the last edit within a short window is actually persisted. A single
  // shared timer (not keyed per-control) is fine here: only one control is
  // ever selected/edited in the Properties Panel at a time.
  const updateActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateActionInControl = useCallback(
    (control: ControlId, index: number, action: Action) => {
      if (updateActionTimer.current) {
        clearTimeout(updateActionTimer.current);
      }
      updateActionTimer.current = setTimeout(() => {
        updateActionTimer.current = null;
        void (async () => {
          try {
            const profile = await api.getActiveProfile();
            const existing = profile.mappings[control] ?? [];
            const others = existing.filter((m) => !(m.trigger === "press" && m.modifier === "none"));
            const current = existing.find((m) => m.trigger === "press" && m.modifier === "none");
            if (!current) return;
            const nextActions = current.actions.map((a, i) => (i === index ? action : a));
            await saveMappingsForControl(control, [...others, { ...current, actions: nextActions }]);
          } catch (err) {
            console.error("Failed to save action update", err);
          }
        })();
      }, 300);
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
    <div className="flex h-screen flex-col bg-bg">
      <AppTitleBar
        deviceStatus={deviceStatus}
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

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <ActionsSidebar obsStatus={obsStatus} onOpenSettings={() => setSettingsOpen(true)} />

        <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto">
          <SpeedEditor
            selected={selected}
            pressed={pressed}
            assigned={assignedControls}
            jogAngle={jogAngle}
            jogActive={jogActive}
            onSelect={setSelected}
            onDropAction={handleDropAction}
          />
        </main>

        <PropertiesPanel
          control={selected}
          actions={actionsForSelected}
          obsStatus={obsStatus}
          onAddAction={(action) => selected && addActionToControl(selected, action)}
          onRemoveAction={(index) => selected && removeActionFromControl(selected, index)}
          onUpdateAction={(index, action) => selected && updateActionInControl(selected, index, action)}
        />
      </div>

      {settingsOpen && (
        <SettingsModal
          obsStatus={obsStatus}
          onObsConnect={(host, port, password) => api.obsConnect(host, port, password)}
          onObsDisconnect={() => api.obsDisconnect()}
          onClose={() => setSettingsOpen(false)}
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
