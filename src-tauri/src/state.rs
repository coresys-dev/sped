use crate::settings::SettingsStore;
use sped_device::{LedController, MockHandle};
use sped_integrations::{KeyboardExecutor, ObsIntegration};
use sped_mapping::{Action, ActionError, ActionExecutor, Dispatcher, MappingEngine, Profile, ProfileError};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// Shared application state, managed by Tauri and reached from every
/// command through `tauri::State<AppState>`.
pub struct AppState {
    pub engine: Mutex<MappingEngine>,
    pub dispatcher: Dispatcher,
    pub obs: Arc<ObsIntegration>,
    pub mock_handle: Mutex<Option<MockHandle>>,
    pub profiles: Mutex<HashMap<String, Profile>>,
    pub active_profile: Mutex<String>,
    pub profiles_dir: PathBuf,
    pub connected: Mutex<bool>,
    pub settings: SettingsStore,
    pub leds: LedController,
}

/// Adapts `Arc<ObsIntegration>` (needed directly by the OBS commands) to
/// the `ActionExecutor` trait object the dispatcher wants, without
/// duplicating the OBS integration.
struct ObsExecutorHandle(Arc<ObsIntegration>);

impl ActionExecutor for ObsExecutorHandle {
    fn execute(&self, action: &Action) -> Result<(), ActionError> {
        self.0.execute(action)
    }
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let profiles_dir = app_data_dir.join("profiles");
        let _ = std::fs::create_dir_all(&profiles_dir);
        let settings = SettingsStore::load(&app_data_dir);

        let mut profiles = load_profiles(&profiles_dir);
        if profiles.is_empty() {
            let default = Profile::new("Default");
            let _ = save_profile_file(&profiles_dir, &default);
            profiles.insert(default.name.clone(), default);
        }

        let active_name = profiles
            .keys()
            .next()
            .cloned()
            .unwrap_or_else(|| "Default".to_string());
        let active_profile = profiles
            .get(&active_name)
            .cloned()
            .unwrap_or_else(|| Profile::new(&active_name));

        let obs = Arc::new(ObsIntegration::new());

        let mut dispatcher = Dispatcher::new();
        dispatcher.register(Box::new(KeyboardExecutor::new()));
        dispatcher.register(Box::new(ObsExecutorHandle(obs.clone())));

        Self {
            engine: Mutex::new(MappingEngine::new(active_profile)),
            dispatcher,
            obs,
            mock_handle: Mutex::new(None),
            profiles: Mutex::new(profiles),
            active_profile: Mutex::new(active_name),
            profiles_dir,
            connected: Mutex::new(false),
            settings,
            leds: LedController::new(),
        }
    }

    pub fn persist(&self, profile: &Profile) -> Result<(), String> {
        save_profile_file(&self.profiles_dir, profile).map_err(|e| e.to_string())
    }

    pub fn remove_file(&self, name: &str) -> Result<(), String> {
        let path = profile_path(&self.profiles_dir, name);
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

fn sanitize(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn profile_path(dir: &Path, name: &str) -> PathBuf {
    dir.join(format!("{}.json", sanitize(name)))
}

fn save_profile_file(dir: &Path, profile: &Profile) -> Result<(), ProfileError> {
    profile.save(&profile_path(dir, &profile.name))
}

fn load_profiles(dir: &Path) -> HashMap<String, Profile> {
    let mut map = HashMap::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return map;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            match Profile::load(&path) {
                Ok(profile) => {
                    map.insert(profile.name.clone(), profile);
                }
                Err(err) => {
                    // Don't let a corrupt/unparseable profile file be
                    // mistaken for "no profiles exist yet" (which would
                    // cause `AppState::new` to overwrite it with an empty
                    // default profile). Move it out of the way instead of
                    // silently dropping it.
                    let backup_path = path.with_extension("json.bak");
                    let _ = std::fs::rename(&path, &backup_path);
                    eprintln!(
                        "warning: failed to load profile {}: {err}; preserved as {}",
                        path.display(),
                        backup_path.display()
                    );
                }
            }
        }
    }
    map
}

#[cfg(test)]
mod sanity_check_tests {
    use super::*;

    #[test]
    fn corrupt_profile_is_preserved_not_dropped() {
        let dir = std::env::temp_dir().join(format!(
            "sped_state_test_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("Default.json");
        std::fs::write(&path, r#"{"version": "not-a-number", "name": "Default"}"#).unwrap();

        let loaded = load_profiles(&dir);
        assert!(loaded.is_empty(), "corrupt profile should not load");

        let backup = dir.join("Default.json.bak");
        assert!(backup.exists(), "corrupt file should be renamed to .bak");
        assert!(!path.exists(), "original corrupt path should be gone");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
