pub mod migrations;
pub mod models;

use migrations::run_migrations;
use models::*;
use rusqlite::{Connection, Result};
use std::path::PathBuf;

static DB_PATH: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

/// Initialize database at the given path
pub fn init(db_path: &PathBuf) -> Result<Connection> {
    DB_PATH.set(db_path.clone()).ok();
    let conn = Connection::open(db_path)?;
    run_migrations(&conn, db_path.parent().unwrap())?;
    Ok(conn)
}

/// Get the stored database path
pub fn get_db_path() -> Option<PathBuf> {
    DB_PATH.get().cloned()
}

// ============== Video CRUD ==============

pub fn insert_video(conn: &Connection, file_path: &str, file_name: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO videos (file_path, file_name) VALUES (?1, ?2)",
        [file_path, file_name],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_video_by_path(conn: &Connection, file_path: &str) -> Result<Option<Video>> {
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, duration, created_at, last_watched_at, watch_count
         FROM videos WHERE file_path = ?1",
    )?;
    let mut rows = stmt.query([file_path])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Video {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            duration: row.get(3)?,
            created_at: row.get(4)?,
            last_watched_at: row.get(5)?,
            watch_count: row.get(6)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn update_video_duration(conn: &Connection, video_id: i64, duration: f64) -> Result<()> {
    conn.execute(
        "UPDATE videos SET duration = ?1 WHERE id = ?2",
        [duration.to_string(), video_id.to_string()],
    )?;
    Ok(())
}

pub fn increment_watch_count(conn: &Connection, video_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE videos SET watch_count = watch_count + 1, last_watched_at = datetime('now') WHERE id = ?1",
        [video_id.to_string()],
    )?;
    Ok(())
}

// ============== Subtitle CRUD ==============

pub fn insert_subtitle(
    conn: &Connection,
    video_id: i64,
    format: &str,
    language: Option<&str>,
    content_raw: &str,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO subtitles (video_id, format, language, content_raw) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![video_id, format, language, content_raw],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_subtitles_by_video(conn: &Connection, video_id: i64) -> Result<Vec<Subtitle>> {
    let mut stmt = conn.prepare(
        "SELECT id, video_id, format, language, content_raw, created_at
         FROM subtitles WHERE video_id = ?1",
    )?;
    let rows = stmt.query_map([video_id], |row| {
        Ok(Subtitle {
            id: row.get(0)?,
            video_id: row.get(1)?,
            format: row.get(2)?,
            language: row.get(3)?,
            content_raw: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

// ============== Watch Progress CRUD ==============

pub fn upsert_watch_progress(
    conn: &Connection,
    video_id: i64,
    position_seconds: f64,
    playback_rate: f64,
    last_position: i64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO watch_progress (video_id, position_seconds, playback_rate, last_position)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(video_id) DO UPDATE SET
         position_seconds = ?2, playback_rate = ?3, last_position = ?4",
        rusqlite::params![video_id, position_seconds, playback_rate, last_position],
    )?;
    Ok(())
}

pub fn get_watch_progress(conn: &Connection, video_id: i64) -> Result<Option<WatchProgress>> {
    let mut stmt = conn.prepare(
        "SELECT id, video_id, position_seconds, playback_rate, last_position
         FROM watch_progress WHERE video_id = ?1",
    )?;
    let mut rows = stmt.query([video_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(WatchProgress {
            id: row.get(0)?,
            video_id: row.get(1)?,
            position_seconds: row.get(2)?,
            playback_rate: row.get(3)?,
            last_position: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

// ============== LLM Cache CRUD ==============

pub fn get_llm_cache(conn: &Connection, subtitle_text_hash: &str) -> Result<Option<LlmCache>> {
    let mut stmt = conn.prepare(
        "SELECT id, subtitle_text_hash, llm_response_json, created_at
         FROM llm_cache WHERE subtitle_text_hash = ?1",
    )?;
    let mut rows = stmt.query([subtitle_text_hash])?;
    if let Some(row) = rows.next()? {
        Ok(Some(LlmCache {
            id: row.get(0)?,
            subtitle_text_hash: row.get(1)?,
            llm_response_json: row.get(2)?,
            created_at: row.get(3)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn insert_llm_cache(conn: &Connection, subtitle_text_hash: &str, llm_response_json: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO llm_cache (subtitle_text_hash, llm_response_json) VALUES (?1, ?2)",
        [subtitle_text_hash, llm_response_json],
    )?;
    Ok(conn.last_insert_rowid())
}

// ============== AB Loop CRUD ==============

pub fn insert_ab_loop(
    conn: &Connection,
    video_id: i64,
    start_time: f64,
    end_time: f64,
    label: Option<&str>,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO ab_loops (video_id, start_time, end_time, label) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![video_id, start_time, end_time, label],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_ab_loops_by_video(conn: &Connection, video_id: i64) -> Result<Vec<AbLoop>> {
    let mut stmt = conn.prepare(
        "SELECT id, video_id, start_time, end_time, label, created_at
         FROM ab_loops WHERE video_id = ?1 ORDER BY start_time",
    )?;
    let rows = stmt.query_map([video_id], |row| {
        Ok(AbLoop {
            id: row.get(0)?,
            video_id: row.get(1)?,
            start_time: row.get(2)?,
            end_time: row.get(3)?,
            label: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn delete_ab_loop(conn: &Connection, loop_id: i64) -> Result<()> {
    conn.execute("DELETE FROM ab_loops WHERE id = ?1", [loop_id.to_string()])?;
    Ok(())
}

// ============== Settings CRUD ==============

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        [key, value],
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query([key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn create_test_db() -> (Connection, PathBuf) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = Connection::open(&db_path).unwrap();

        // Create migrations dir and file
        let migrations_dir = dir.path().join("migrations");
        fs::create_dir_all(&migrations_dir).unwrap();
        fs::write(
            migrations_dir.join("001_initial.sql"),
            include_str!("../../migrations/001_initial.sql"),
        )
        .unwrap();

        run_migrations(&conn, dir.path()).unwrap();
        (conn, dir.path().to_path_buf())
    }

    #[test]
    fn test_video_crud() {
        let (conn, _dir) = create_test_db();

        let id = insert_video(&conn, "/path/to/video.mp4", "video.mp4").unwrap();
        assert!(id > 0);

        let video = get_video_by_path(&conn, "/path/to/video.mp4").unwrap();
        assert!(video.is_some());
        let v = video.unwrap();
        assert_eq!(v.file_name, "video.mp4");
        assert_eq!(v.watch_count, 0);
    }

    #[test]
    fn test_watch_progress_upsert() {
        let (conn, _dir) = create_test_db();

        let video_id = insert_video(&conn, "/test.mp4", "test.mp4").unwrap();

        upsert_watch_progress(&conn, video_id, 30.5, 1.0, 30000).unwrap();

        let progress = get_watch_progress(&conn, video_id).unwrap();
        assert!(progress.is_some());
        let p = progress.unwrap();
        assert_eq!(p.position_seconds, 30.5);
    }

    #[test]
    fn test_settings_crud() {
        let (conn, _dir) = create_test_db();

        set_setting(&conn, "playback_rate", "1.5").unwrap();
        let value = get_setting(&conn, "playback_rate").unwrap();
        assert_eq!(value, Some("1.5".to_string()));

        set_setting(&conn, "playback_rate", "2.0").unwrap();
        let value = get_setting(&conn, "playback_rate").unwrap();
        assert_eq!(value, Some("2.0".to_string()));
    }

    #[test]
    fn test_llm_cache_crud() {
        let (conn, _dir) = create_test_db();

        let hash = "abc123";
        let response = r#"{"translation": "hello"}"#;
        insert_llm_cache(&conn, hash, response).unwrap();

        let cached = get_llm_cache(&conn, hash).unwrap();
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().llm_response_json, response);
    }

    #[test]
    fn test_ab_loop_crud() {
        let (conn, _dir) = create_test_db();

        let video_id = insert_video(&conn, "/loop_test.mp4", "loop_test.mp4").unwrap();

        let loop_id = insert_ab_loop(&conn, video_id, 10.0, 20.0, Some("intro")).unwrap();
        assert!(loop_id > 0);

        let loops = get_ab_loops_by_video(&conn, video_id).unwrap();
        assert_eq!(loops.len(), 1);
        assert_eq!(loops[0].start_time, 10.0);
        assert_eq!(loops[0].label, Some("intro".to_string()));

        delete_ab_loop(&conn, loop_id).unwrap();
        let loops = get_ab_loops_by_video(&conn, video_id).unwrap();
        assert!(loops.is_empty());
    }
}