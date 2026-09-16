use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const KEYRING_SERVICE: &str = "com.coresys.speededitor";
const KEYRING_OBS_ACCOUNT: &str = "obs-websocket";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsSettings {
    pub host: String,
    pub port: u16,
    /// Connect automatically at startup using the saved host/port and the
    /// password in the OS keyring (never in this JSON file).
    pub autoconnect: bool,
}

impl Default for ObsSettings {
    fn default() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 4455,
            autoconnect: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JogSettings {
    /// Multiplier applied to raw wheel deltas. 1.0 = hardware-reported
    /// value untouched. Default (0.5) is deliberately tame -- the raw
    /// deltas from the wheel are large enough that 1.0 reads as far too
    /// sensitive in practice.
    pub sensitivity: f32,
    pub invert: bool,
    /// Raw per-event delta magnitude at or below which a jog/shuttle event
    /// is dropped entirely (not even emitted to the frontend), to absorb
    /// the wheel's smallest, likely-unintentional movements.
    pub deadzone: i32,
}

impl Default for JogSettings {
    fn default() -> Self {
        Self {
            sensitivity: 0.5,
            invert: false,
            deadzone: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    /// Whether the dev-mode event log / mock panel is shown. Independent
    /// of the `SPED_MOCK` env var so it can be toggled without restarting.
    pub debug_overlay: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub obs: ObsSettings,
    #[serde(default)]
    pub jog: JogSettings,
    #[serde(default)]
    pub general: GeneralSettings,
}

pub struct SettingsStore {
    path: PathBuf,
    settings: Mutex<AppSettings>,
}

impl SettingsStore {
    pub fn load(dir: &Path) -> Self {
        let path = dir.join("settings.json");
        let settings = std::fs::read_to_string(&path)
            .ok()
            .and_then(|data| serde_json::from_str(&data).ok())
            .unwrap_or_default();
        Self {
            path,
            settings: Mutex::new(settings),
        }
    }

    pub fn get(&self) -> AppSettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn update(&self, settings: AppSettings) -> Result<(), String> {
        *self.settings.lock().unwrap() = settings.clone();
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
        std::fs::write(&self.path, json).map_err(|e| e.to_string())
    }
}

fn obs_keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_OBS_ACCOUNT).map_err(|e| e.to_string())
}

pub fn get_obs_password() -> Option<String> {
    obs_keyring_entry().ok()?.get_password().ok()
}

pub fn set_obs_password(password: &str) -> Result<(), String> {
    obs_keyring_entry()?
        .set_password(password)
        .map_err(|e| e.to_string())
}

pub fn clear_obs_password() -> Result<(), String> {
    match obs_keyring_entry()?.delete_credential() {
        Ok(()) => Ok(()),
        // Already absent is not an error from the caller's point of view.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
