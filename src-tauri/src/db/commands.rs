use crate::db;
use crate::db::models::{AbLoop, Video, WatchProgress};
use serde::Serialize;
use tauri::State;

/// Wrapper for database connection managed by Tauri state
pub struct DbState(pub std::sync::Mutex<rusqlite::Connection>);

// ============== Progress Commands ==============

#[tauri::command]
pub fn save_progress(
    state: State<'_, DbState>,
    video_id: i64,
    position_seconds: f64,
    playback_rate: f64,
    last_position: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::upsert_watch_progress(&conn, video_id, position_seconds, playback_rate, last_position)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_progress(state: State<'_, DbState>, video_id: i64) -> Result<Option<WatchProgress>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_watch_progress(&conn, video_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn increment_watch_count(state: State<'_, DbState>, video_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::increment_watch_count(&conn, video_id).map_err(|e| e.to_string())
}

// ============== Video List Commands ==============

/// Video info with progress percentage for the video list view
#[derive(Debug, Clone, Serialize)]
pub struct VideoInfo {
    pub id: i64,
    pub file_name: String,
    pub file_path: String,
    pub watch_count: i32,
    pub last_watched_at: Option<String>,
    pub progress_percent: f64,
}

#[tauri::command]
pub fn list_videos(state: State<'_, DbState>) -> Result<Vec<VideoInfo>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT v.id, v.file_name, v.file_path, v.watch_count, v.last_watched_at, v.duration,
                    wp.position_seconds
             FROM videos v
             LEFT JOIN watch_progress wp ON v.id = wp.video_id
             ORDER BY v.last_watched_at DESC NULLS LAST, v.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let file_name: String = row.get(1)?;
            let file_path: String = row.get(2)?;
            let watch_count: i32 = row.get(3)?;
            let last_watched_at: Option<String> = row.get(4)?;
            let duration: Option<f64> = row.get(5)?;
            let position_seconds: Option<f64> = row.get(6)?;

            let progress_percent = match (duration, position_seconds) {
                (Some(dur), Some(pos)) if dur > 0.0 => (pos / dur * 100.0).min(100.0),
                _ => 0.0,
            };

            Ok(VideoInfo {
                id,
                file_name,
                file_path,
                watch_count,
                last_watched_at,
                progress_percent,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ============== A-B Loop Commands ==============

#[tauri::command]
pub fn save_ab_loop(
    state: State<'_, DbState>,
    video_id: i64,
    start_time: f64,
    end_time: f64,
    label: Option<String>,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::insert_ab_loop(&conn, video_id, start_time, end_time, label.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_ab_loop(state: State<'_, DbState>, loop_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_ab_loop(&conn, loop_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_ab_loops(state: State<'_, DbState>, video_id: i64) -> Result<Vec<AbLoop>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_ab_loops_by_video(&conn, video_id).map_err(|e| e.to_string())
}

// ============== Video Commands ==============

#[tauri::command]
pub fn get_video_by_path(state: State<'_, DbState>, file_path: String) -> Result<Option<Video>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_video_by_path(&conn, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn insert_video(
    state: State<'_, DbState>,
    file_path: String,
    file_name: String,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::insert_video(&conn, &file_path, &file_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_video_duration(
    state: State<'_, DbState>,
    video_id: i64,
    duration: f64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_video_duration(&conn, video_id, duration).map_err(|e| e.to_string())
}

// ============== Settings Commands ==============

#[tauri::command]
pub fn get_setting(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}