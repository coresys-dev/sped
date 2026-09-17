import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { api, onDeviceEvent } from "./api";
import { ActionsSidebar } from "./components/ActionsSidebar";
import { IconButton } from "./cscl-ui/primitives/IconButton";
import { useTheme } from "./cscl-ui/lib/hooks/useTheme";
import { DevPanel } from "./components/DevPanel";
import { ProfileManager } from "./components/ProfileManager";
import { ProfileTabBar } from "./components/ProfileTabBar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SettingsModal } from "./components/SettingsModal";
import { SpeedEditor } from "./components/SpeedEditor";
import {
  LED_CAM_GROUP,
  LED_IDS,
  type Action,
  type AppSettings,
  type ControlEvent,
  type ControlId,
  type DeviceStatus,
  type LedId,
  type Mapping,
  type ObsStatus,
  type Profile,
} from "./types";

const LED_ID_SET = new Set<string>(LED_IDS);

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
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const settingsRef = useRef<AppSettings | null>(null);
  const saveSettingsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [devPanelOpen, setDevPanelOpen] = useState(DEV_MODE);
  const [eventLog, setEventLog] = useState<{ time: string; event: ControlEvent }[]>([]);
  const [litLeds, setLitLeds] = useState<Set<LedId>>(new Set());

  useTheme(settings?.experience.theme ?? null);

  const patchSettings = useCallback((next: AppSettings) => {
    settingsRef.current = next;
    setSettings(next);
    if (saveSettingsTimeout.current) clearTimeout(saveSettingsTimeout.current);
    saveSettingsTimeout.current = setTimeout(() => api.setSettings(next), 250);
  }, []);

  const toggleLed = useCallback((id: LedId, on: boolean) => {
    api.setLed(id, on).catch(() => {});
    setLitLeds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearAllLeds = useCallback(() => {
    api.clearLeds().catch(() => {});
    setLitLeds(new Set());
  }, []);

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
      .then((s) => {
        setDevPanelOpen((open) => open || s.general.debugOverlay);
        settingsRef.current = s;
        setSettings(s);
      })
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
        case "pressed": {
          setPressed((prev) => new Set(prev).add(event.control));

          const led = event.control as LedId;
          const ledFeedback = settingsRef.current?.experience.ledFeedback;
          if (ledFeedback?.enabled && LED_ID_SET.has(event.control)) {
            setLitLeds((prev) => {
              const next = new Set(prev);
              if (next.has(led)) {
                next.delete(led);
                api.setLed(led, false).catch(() => {});
                return next;
              }
              if (ledFeedback.exclusiveCam && LED_CAM_GROUP.has(led)) {
                for (const other of next) {
                  if (LED_CAM_GROUP.has(other)) {
                    next.delete(other);
                    api.setLed(other, false).catch(() => {});
                  }
                }
              }
              next.add(led);
              api.setLed(led, true).catch(() => {});
              return next;
            });
          }
          break;
        }
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
      <ProfileTabBar
        profiles={profiles}
        activeProfile={activeProfileName}
        onSelect={async (name) => {
          await api.selectProfile(name);
          await refreshProfiles();
        }}
        onCreate={async (name) => {
          await api.createProfile(name);
          await api.selectProfile(name);
          await refreshProfiles();
        }}
        onDelete={async (name) => {
          await api.deleteProfile(name);
          await refreshProfiles();
        }}
        trailing={
          <>
            <ProfileManager
              activeProfile={activeProfileName}
              onDuplicate={async (name) => {
                await api.duplicateProfile(activeProfileName, name);
                await api.selectProfile(name);
                await refreshProfiles();
              }}
              onRename={async (name) => {
                await api.renameProfile(activeProfileName, name);
                await refreshProfiles();
              }}
              onExport={async () => {
                const json = await api.exportProfile(activeProfileName);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${activeProfileName}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              onImport={async (json) => {
                const name = await api.importProfile(json);
                await api.selectProfile(name);
                await refreshProfiles();
              }}
            />
            <IconButton aria-label="Open settings" variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </IconButton>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <ActionsSidebar obsStatus={obsStatus} deviceStatus={deviceStatus} />

        <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto">
          <SpeedEditor
            selected={selected}
            pressed={pressed}
            assigned={assignedControls}
            jogAngle={jogAngle}
            jogActive={jogActive}
            litLeds={litLeds}
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

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          onChange={patchSettings}
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
          litLeds={litLeds}
          onToggleLed={toggleLed}
          onClearLeds={clearAllLeds}
          onClose={() => setDevPanelOpen(false)}
        />
      )}
    </div>
  );
}
