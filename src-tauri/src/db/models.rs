use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    pub id: i64,
    pub file_path: String,
    pub file_name: String,
    pub duration: Option<f64>,
    pub created_at: String,
    pub last_watched_at: Option<String>,
    pub watch_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtitle {
    pub id: i64,
    pub video_id: i64,
    pub format: String,
    pub language: Option<String>,
    pub content_raw: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchProgress {
    pub id: i64,
    pub video_id: i64,
    pub position_seconds: f64,
    pub playback_rate: f64,
    pub last_position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmCache {
    pub id: i64,
    pub subtitle_text_hash: String,
    pub llm_response_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbLoop {
    pub id: i64,
    pub video_id: i64,
    pub start_time: f64,
    pub end_time: f64,
    pub label: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}