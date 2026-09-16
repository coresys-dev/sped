mod commands;
mod device_manager;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::try_init().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let profiles_dir = app.path().app_data_dir()?.join("profiles");
            app.manage(AppState::new(profiles_dir));
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
            commands::mock_send,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
