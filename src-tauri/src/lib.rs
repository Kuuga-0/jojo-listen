mod db;
mod llm;

use db::commands::DbState;
use tauri::Manager;

#[tauri::command]
fn convert_file_src(path: String) -> String {
    format!("asset://localhost/{}", path.trim_start_matches('/'))
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

            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let db_path = app_data_dir.join("jojo-listen.db");
            log::info!("Database path: {:?}", db_path);

            let conn = db::init(&db_path).expect("Failed to initialize database");
            log::info!("Database initialized successfully");

            app.manage(DbState(std::sync::Mutex::new(conn)));

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            convert_file_src,
            llm::analyze_sentence,
            db::commands::save_progress,
            db::commands::get_progress,
            db::commands::increment_watch_count,
            db::commands::list_videos,
            db::commands::save_ab_loop,
            db::commands::delete_ab_loop,
            db::commands::get_ab_loops,
            db::commands::get_video_by_path,
            db::commands::insert_video,
            db::commands::update_video_duration,
            db::commands::get_setting,
            db::commands::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}