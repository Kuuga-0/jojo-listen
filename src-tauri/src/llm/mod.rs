pub mod types;

use types::*;
use crate::db;

const SYSTEM_PROMPT: &str = r#"You are a language learning assistant. Analyze the given sentence and return a JSON object with the following structure:
{
  "translation": "A natural translation of the sentence",
  "usage_context": [
    {"example": "An example sentence using similar patterns", "explanation": "Explanation of the usage context"}
  ],
  "grammar_notes": [
    {"point": "Grammar point name", "explanation": "Explanation of this grammar point"}
  ],
  "vocabulary": [
    {"word": "word", "definition": "definition", "pronunciation": "pronunciation guide"}
  ]
}

Provide at least 1 usage context example, at least 1 grammar note, and list all key vocabulary words. Return ONLY valid JSON, no markdown formatting."#;

const MAX_RETRIES: u32 = 3;
const INITIAL_DELAY_SECS: u64 = 1;
const MAX_DELAY_SECS: u64 = 10;
const REQUEST_TIMEOUT_SECS: u64 = 30;
const DEFAULT_API_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o-mini";

#[tauri::command]
pub async fn analyze_sentence(
    sentence: String,
    context: Vec<String>,
    api_key: String,
) -> Result<LLMResponse, String> {
    let db_path = db::get_db_path().ok_or("Database not initialized")?;
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    let api_url = db::get_setting(&conn, "llm_api_url")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| DEFAULT_API_URL.to_string());

    let model = db::get_setting(&conn, "llm_model")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    drop(conn);

    let user_message = if context.is_empty() {
        format!("Analyze this sentence: {}", sentence)
    } else {
        format!(
            "Analyze this sentence in context:\nContext: {}\nSentence: {}",
            context.join(" | "),
            sentence
        )
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let request_body = ChatCompletionRequest {
        model: model.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: SYSTEM_PROMPT.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_message,
            },
        ],
        temperature: 0.3,
        response_format: ResponseFormat {
            r#type: "json_object".to_string(),
        },
    };

    let url = format!("{}/chat/completions", api_url.trim_end_matches('/'));
    let mut last_error = String::new();

    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            let delay = std::cmp::min(
                INITIAL_DELAY_SECS * 2u64.pow(attempt - 1),
                MAX_DELAY_SECS,
            );
            tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
        }

        let response = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    match resp.text().await {
                        Ok(body) => {
                            match parse_llm_response(&body) {
                                Ok(result) => return Ok(result),
                                Err(e) => {
                                    last_error = format!("Failed to parse LLM response: {}", e);
                                    if attempt == MAX_RETRIES {
                                        return Err(last_error);
                                    }
                                    continue;
                                }
                            }
                        }
                        Err(e) => {
                            last_error = format!("Failed to read response body: {}", e);
                            if attempt == MAX_RETRIES {
                                return Err(last_error);
                            }
                            continue;
                        }
                    }
                } else {
                    let status = resp.status();
                    let error_body = resp.text().await.unwrap_or_default();
                    last_error = format!("API error {}: {}", status, error_body);
                    if status.as_u16() == 401 || status.as_u16() == 403 {
                        return Err(last_error);
                    }
                    if attempt == MAX_RETRIES {
                        return Err(last_error);
                    }
                    continue;
                }
            }
            Err(e) => {
                if e.is_timeout() {
                    last_error = "Request timed out".to_string();
                } else {
                    last_error = format!("Request failed: {}", e);
                }
                if attempt == MAX_RETRIES {
                    return Err(last_error);
                }
                continue;
            }
        }
    }

    Err(format!("All retries exhausted: {}", last_error))
}

fn parse_llm_response(body: &str) -> Result<LLMResponse, String> {
    let api_response: ChatCompletionResponse =
        serde_json::from_str(body).map_err(|e| format!("Invalid API response JSON: {}", e))?;

    let content = api_response
        .choices
        .first()
        .ok_or("No choices in API response")?
        .message
        .content
        .clone();

    let llm_response: LLMResponse =
        serde_json::from_str(&content).map_err(|e| format!("Invalid LLM output JSON: {}", e))?;

    Ok(llm_response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_llm_response_valid() {
        let body = r#"{
            "choices": [{
                "message": {
                    "content": "{\"translation\":\"Hello\",\"usage_context\":[{\"example\":\"Hello there\",\"explanation\":\"Greeting\"}],\"grammar_notes\":[{\"point\":\"Subject-verb\",\"explanation\":\"Agreement\"}],\"vocabulary\":[{\"word\":\"hello\",\"definition\":\"A greeting\",\"pronunciation\":\"/həˈloʊ/\"}]}"
                }
            }]
        }"#;

        let result = parse_llm_response(body).unwrap();
        assert_eq!(result.translation, "Hello");
        assert_eq!(result.usage_context.len(), 1);
        assert_eq!(result.usage_context[0].example, "Hello there");
        assert_eq!(result.grammar_notes.len(), 1);
        assert_eq!(result.vocabulary.len(), 1);
        assert_eq!(result.vocabulary[0].word, "hello");
    }

    #[test]
    fn test_parse_llm_response_invalid_api_json() {
        let body = "not json at all";
        let result = parse_llm_response(body);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid API response JSON"));
    }

    #[test]
    fn test_parse_llm_response_empty_choices() {
        let body = r#"{"choices":[]}"#;
        let result = parse_llm_response(body);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No choices"));
    }

    #[test]
    fn test_parse_llm_response_invalid_content_json() {
        let body = r#"{"choices":[{"message":{"content":"not valid json"}}]}"#;
        let result = parse_llm_response(body);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid LLM output JSON"));
    }

    #[test]
    fn test_retry_delay_calculation() {
        assert_eq!(std::cmp::min(INITIAL_DELAY_SECS * 2u64.pow(0), MAX_DELAY_SECS), 1);
        assert_eq!(std::cmp::min(INITIAL_DELAY_SECS * 2u64.pow(1), MAX_DELAY_SECS), 2);
        assert_eq!(std::cmp::min(INITIAL_DELAY_SECS * 2u64.pow(2), MAX_DELAY_SECS), 4);
        assert_eq!(std::cmp::min(INITIAL_DELAY_SECS * 2u64.pow(3), MAX_DELAY_SECS), 8);
        assert_eq!(std::cmp::min(INITIAL_DELAY_SECS * 2u64.pow(4), MAX_DELAY_SECS), 10);
    }

    #[test]
    fn test_default_settings() {
        assert_eq!(DEFAULT_API_URL, "https://api.openai.com/v1");
        assert_eq!(DEFAULT_MODEL, "gpt-4o-mini");
        assert_eq!(MAX_RETRIES, 3);
        assert_eq!(INITIAL_DELAY_SECS, 1);
        assert_eq!(MAX_DELAY_SECS, 10);
        assert_eq!(REQUEST_TIMEOUT_SECS, 30);
    }

    #[test]
    fn test_system_prompt_contains_json_instruction() {
        assert!(SYSTEM_PROMPT.contains("json_object") || SYSTEM_PROMPT.contains("JSON"));
        assert!(SYSTEM_PROMPT.contains("translation"));
        assert!(SYSTEM_PROMPT.contains("usage_context"));
        assert!(SYSTEM_PROMPT.contains("grammar_notes"));
        assert!(SYSTEM_PROMPT.contains("vocabulary"));
    }

    #[test]
    fn test_user_message_with_context() {
        let sentence = "私は学生です";
        let context = vec!["昨日の話ですが".to_string(), "彼も学生です".to_string()];
        let user_message = format!(
            "Analyze this sentence in context:\nContext: {}\nSentence: {}",
            context.join(" | "),
            sentence
        );
        assert!(user_message.contains("昨日の話ですが"));
        assert!(user_message.contains("私は学生です"));
    }

    #[test]
    fn test_user_message_without_context() {
        let sentence = "Hello world";
        let user_message = format!("Analyze this sentence: {}", sentence);
        assert_eq!(user_message, "Analyze this sentence: Hello world");
    }

    #[test]
    fn test_url_formatting() {
        let api_url = "https://api.openai.com/v1/";
        let url = format!("{}/chat/completions", api_url.trim_end_matches('/'));
        assert_eq!(url, "https://api.openai.com/v1/chat/completions");
    }
}