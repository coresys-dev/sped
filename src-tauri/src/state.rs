use sped_device::MockHandle;
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
    pub fn new(profiles_dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&profiles_dir);

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
            if let Ok(profile) = Profile::load(&path) {
                map.insert(profile.name.clone(), profile);
            }
        }
    }
    map
}
