mod commands;
mod device_manager;
mod settings;
mod state;
mod window_chrome;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::try_init().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state = AppState::new(app_data_dir);

            let settings = state.settings.get();
            if settings.obs.autoconnect {
                let password = settings::get_obs_password();
                state.obs.connect(settings.obs.host, settings.obs.port, password);
            }

            app.manage(state);
            device_manager::spawn(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_controls,
            commands::get_device_status,
            commands::list_profiles,
            commands::get_active_profile_name,
            commands::get_active_profile,
            commands::select_profile,
            commands::create_profile,
            commands::duplicate_profile,
            commands::rename_profile,
            commands::delete_profile,
            commands::export_profile,
            commands::import_profile,
            commands::set_mapping,
            commands::get_mapping,
            commands::obs_connect,
            commands::obs_disconnect,
            commands::obs_status,
            commands::obs_scene_items,
            commands::mock_send,
            commands::get_settings,
            commands::set_settings,
            commands::set_obs_password,
            commands::clear_obs_password,
            commands::has_obs_password,
            commands::get_leds,
            commands::set_led,
            commands::clear_leds,
            window_chrome::position_traffic_lights,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
