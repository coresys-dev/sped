use crate::settings::{self, AppSettings};
use crate::state::AppState;
use serde::Serialize;
use sped_device::{ControlId, LedId, MockCommand};
use sped_integrations::ObsStatus;
use sped_mapping::{Mapping, Profile};
use tauri::State;

#[derive(Serialize)]
pub struct DeviceStatus {
    pub connected: bool,
    pub mock: bool,
}

fn parse_control(id: &str) -> Result<ControlId, String> {
    ControlId::ALL
        .iter()
        .find(|c| c.as_str() == id)
        .copied()
        .ok_or_else(|| format!("unknown control: {id}"))
}

#[tauri::command]
pub fn get_controls() -> Vec<String> {
    ControlId::ALL.iter().map(|c| c.as_str().to_string()).collect()
}

#[tauri::command]
pub fn get_device_status(state: State<AppState>) -> DeviceStatus {
    DeviceStatus {
        connected: *state.connected.lock().unwrap(),
        mock: state.mock_handle.lock().unwrap().is_some(),
    }
}

#[tauri::command]
pub fn list_profiles(state: State<AppState>) -> Vec<String> {
    let mut names: Vec<String> = state.profiles.lock().unwrap().keys().cloned().collect();
    names.sort();
    names
}

#[tauri::command]
pub fn get_active_profile_name(state: State<AppState>) -> String {
    state.active_profile.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_active_profile(state: State<AppState>) -> Profile {
    let active = state.active_profile.lock().unwrap().clone();
    state
        .profiles
        .lock()
        .unwrap()
        .get(&active)
        .cloned()
        .unwrap_or_else(|| Profile::new(active))
}

#[tauri::command]
pub fn select_profile(state: State<AppState>, name: String) -> Result<(), String> {
    let profile = {
        let profiles = state.profiles.lock().unwrap();
        profiles
            .get(&name)
            .cloned()
            .ok_or_else(|| format!("unknown profile: {name}"))?
    };
    state.engine.lock().unwrap().set_profile(profile);
    *state.active_profile.lock().unwrap() = name;
    Ok(())
}

#[tauri::command]
pub fn create_profile(state: State<AppState>, name: String) -> Result<(), String> {
    let mut profiles = state.profiles.lock().unwrap();
    if profiles.contains_key(&name) {
        return Err(format!("profile '{name}' already exists"));
    }
    let profile = Profile::new(name.clone());
    state.persist(&profile)?;
    profiles.insert(name, profile);
    Ok(())
}

#[tauri::command]
pub fn duplicate_profile(
    state: State<AppState>,
    name: String,
    new_name: String,
) -> Result<(), String> {
    let mut profiles = state.profiles.lock().unwrap();
    if profiles.contains_key(&new_name) {
        return Err(format!("profile '{new_name}' already exists"));
    }
    let source = profiles
        .get(&name)
        .cloned()
        .ok_or_else(|| format!("unknown profile: {name}"))?;
    let duplicate = source.duplicate(new_name.clone());
    state.persist(&duplicate)?;
    profiles.insert(new_name, duplicate);
    Ok(())
}

#[tauri::command]
pub fn rename_profile(
    state: State<AppState>,
    name: String,
    new_name: String,
) -> Result<(), String> {
    let mut profiles = state.profiles.lock().unwrap();
    if name != new_name && profiles.contains_key(&new_name) {
        return Err(format!("profile '{new_name}' already exists"));
    }
    let mut profile = profiles
        .remove(&name)
        .ok_or_else(|| format!("unknown profile: {name}"))?;
    state.remove_file(&name)?;
    profile.name = new_name.clone();
    state.persist(&profile)?;
    profiles.insert(new_name.clone(), profile);
    drop(profiles);

    let mut active = state.active_profile.lock().unwrap();
    if *active == name {
        *active = new_name;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_profile(state: State<AppState>, name: String) -> Result<(), String> {
    let mut profiles = state.profiles.lock().unwrap();
    if profiles.len() <= 1 {
        return Err("cannot delete the last remaining profile".into());
    }
    profiles
        .remove(&name)
        .ok_or_else(|| format!("unknown profile: {name}"))?;
    state.remove_file(&name)?;

    let mut active = state.active_profile.lock().unwrap();
    if *active == name {
        if let Some((fallback_name, fallback_profile)) =
            profiles.iter().next().map(|(k, v)| (k.clone(), v.clone()))
        {
            *active = fallback_name;
            state.engine.lock().unwrap().set_profile(fallback_profile);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn export_profile(state: State<AppState>, name: String) -> Result<String, String> {
    let profiles = state.profiles.lock().unwrap();
    let profile = profiles
        .get(&name)
        .ok_or_else(|| format!("unknown profile: {name}"))?;
    profile.to_json().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_profile(
    state: State<AppState>,
    json: String,
    name: Option<String>,
) -> Result<String, String> {
    let mut profile = Profile::from_json(&json).map_err(|e| e.to_string())?;
    if let Some(name) = name {
        profile.name = name;
    }
    let mut profiles = state.profiles.lock().unwrap();
    let key = profile.name.clone();
    state.persist(&profile)?;
    profiles.insert(key.clone(), profile);
    Ok(key)
}

#[tauri::command]
pub fn set_mapping(
    state: State<AppState>,
    control: String,
    mappings: Vec<Mapping>,
) -> Result<(), String> {
    let control_id = parse_control(&control)?;
    let active = state.active_profile.lock().unwrap().clone();
    let mut profiles = state.profiles.lock().unwrap();
    let profile = profiles.get_mut(&active).ok_or("no active profile")?;
    profile.set_mappings(control_id, mappings);
    state.persist(profile)?;
    state.engine.lock().unwrap().set_profile(profile.clone());
    Ok(())
}

#[tauri::command]
pub fn get_mapping(state: State<AppState>, control: String) -> Result<Vec<Mapping>, String> {
    let control_id = parse_control(&control)?;
    let active = state.active_profile.lock().unwrap().clone();
    let profiles = state.profiles.lock().unwrap();
    let profile = profiles.get(&active).ok_or("no active profile")?;
    Ok(profile.mappings_for(control_id).to_vec())
}

#[tauri::command]
pub fn obs_connect(state: State<AppState>, host: String, port: u16, password: Option<String>) {
    // The frontend's password field is a *draft* for setting a new
    // password (via "Save"), not a mirror of what's stored -- if the user
    // already saved one earlier and leaves the field empty when clicking
    // Connect, fall back to the stored keyring password rather than
    // silently connecting unauthenticated (which fails the handshake
    // against any OBS instance with authentication enabled).
    let password = password.filter(|p| !p.is_empty()).or_else(settings::get_obs_password);
    state.obs.connect(host, port, password);
}

#[tauri::command]
pub fn obs_disconnect(state: State<AppState>) {
    state.obs.disconnect();
}

#[tauri::command]
pub fn obs_status(state: State<AppState>) -> ObsStatus {
    state.obs.status()
}

#[tauri::command]
pub fn mock_send(state: State<AppState>, command: MockCommand) -> Result<(), String> {
    let guard = state.mock_handle.lock().unwrap();
    match guard.as_ref() {
        Some(handle) => {
            handle.send(command);
            Ok(())
        }
        None => Err("mock mode is not active (set SPED_MOCK=1 and restart)".into()),
    }
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppSettings {
    state.settings.get()
}

#[tauri::command]
pub fn set_settings(state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    state.settings.update(settings)
}

#[tauri::command]
pub fn set_obs_password(password: String) -> Result<(), String> {
    settings::set_obs_password(&password)
}

#[tauri::command]
pub fn clear_obs_password() -> Result<(), String> {
    settings::clear_obs_password()
}

#[tauri::command]
pub fn has_obs_password() -> bool {
    settings::get_obs_password().is_some()
}

#[tauri::command]
pub fn get_leds() -> Vec<LedId> {
    LedId::ALL.to_vec()
}

#[tauri::command]
pub fn set_led(state: State<AppState>, led: LedId, on: bool) -> Result<(), String> {
    state.leds.set(led, on).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_leds(state: State<AppState>) -> Result<(), String> {
    state.leds.clear_all().map_err(|e| e.to_string())
}
