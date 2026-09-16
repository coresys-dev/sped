import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ControlEvent, DeviceStatus, Mapping, MockCommand, ObsStatus, Profile } from "./types";

export const api = {
  getControls: () => invoke<string[]>("get_controls"),
  getDeviceStatus: () => invoke<DeviceStatus>("get_device_status"),

  listProfiles: () => invoke<string[]>("list_profiles"),
  getActiveProfileName: () => invoke<string>("get_active_profile_name"),
  getActiveProfile: () => invoke<Profile>("get_active_profile"),
  selectProfile: (name: string) => invoke<void>("select_profile", { name }),
  createProfile: (name: string) => invoke<void>("create_profile", { name }),
  duplicateProfile: (name: string, newName: string) =>
    invoke<void>("duplicate_profile", { name, newName }),
  renameProfile: (name: string, newName: string) =>
    invoke<void>("rename_profile", { name, newName }),
  deleteProfile: (name: string) => invoke<void>("delete_profile", { name }),
  exportProfile: (name: string) => invoke<string>("export_profile", { name }),
  importProfile: (json: string, name?: string) => invoke<string>("import_profile", { json, name }),

  getMapping: (control: string) => invoke<Mapping[]>("get_mapping", { control }),
  setMapping: (control: string, mappings: Mapping[]) =>
    invoke<void>("set_mapping", { control, mappings }),

  obsConnect: (host: string, port: number, password?: string) =>
    invoke<void>("obs_connect", { host, port, password }),
  obsDisconnect: () => invoke<void>("obs_disconnect"),
  obsStatus: () => invoke<ObsStatus>("obs_status"),

  mockSend: (command: MockCommand) => invoke<void>("mock_send", { command }),
};

export function onDeviceEvent(handler: (event: ControlEvent) => void): Promise<UnlistenFn> {
  return listen<ControlEvent>("device-event", (e) => handler(e.payload));
}
