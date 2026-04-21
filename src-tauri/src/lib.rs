// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod db;

use tauri::Manager;

#[tauri::command]
fn convert_file_src(path: String) -> String {
    // In Tauri v2, use the PathResolver trait's convert_file_src method
    use tauri::path::PathResolver;
    PathResolver::convert_file_src(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_keychain::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            log::info!("jojo-listen starting...");

            // Initialize database
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let db_path = app_data_dir.join("jojo-listen.db");
            log::info!("Database path: {:?}", db_path);

            let _conn = db::init(&db_path).expect("Failed to initialize database");
            log::info!("Database initialized successfully");

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, convert_file_src])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}