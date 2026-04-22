use serde::{Deserialize, Serialize};

/// Response from LLM analysis of a sentence.
/// This struct matches the TypeScript `LLMResponse` interface expected by the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LLMResponse {
    pub translation: String,
    pub usage_context: Vec<UsageContext>,
    pub grammar_notes: Vec<GrammarNote>,
    pub vocabulary: Vec<VocabularyItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UsageContext {
    pub example: String,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GrammarNote {
    pub point: String,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VocabularyItem {
    pub word: String,
    pub definition: String,
    pub pronunciation: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ChatCompletionRequest {
    pub(crate) model: String,
    pub(crate) messages: Vec<ChatMessage>,
    pub(crate) temperature: f32,
    pub(crate) response_format: ResponseFormat,
}

#[derive(Debug, Serialize)]
pub(crate) struct ChatMessage {
    pub(crate) role: String,
    pub(crate) content: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ResponseFormat {
    pub(crate) r#type: String,
}

/// Internal response from OpenAI-compatible chat completion API.
#[derive(Debug, Deserialize)]
pub(crate) struct ChatCompletionResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Choice {
    pub message: ChoiceMessage,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChoiceMessage {
    pub content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_response_serialization() {
        let response = LLMResponse {
            translation: "Hello".to_string(),
            usage_context: vec![UsageContext {
                example: "Hello, how are you?".to_string(),
                explanation: "Common greeting".to_string(),
            }],
            grammar_notes: vec![GrammarNote {
                point: "Subject-verb agreement".to_string(),
                explanation: "The verb must agree with the subject".to_string(),
            }],
            vocabulary: vec![VocabularyItem {
                word: "hello".to_string(),
                definition: "A greeting".to_string(),
                pronunciation: "/həˈloʊ/".to_string(),
            }],
        };

        let json = serde_json::to_string(&response).unwrap();
        let parsed: LLMResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, response);
    }

    #[test]
    fn test_llm_response_deserialization() {
        let json = r#"{
            "translation": "こんにちは",
            "usage_context": [
                {"example": "こんにちは、元気ですか？", "explanation": "一般的な挨拶"}
            ],
            "grammar_notes": [
                {"point": "主語と動詞の一致", "explanation": "動詞は主語と一致する必要がある"}
            ],
            "vocabulary": [
                {"word": "こんにちは", "definition": "挨拶", "pronunciation": "/konnichiwa/"}
            ]
        }"#;

        let response: LLMResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.translation, "こんにちは");
        assert_eq!(response.usage_context.len(), 1);
        assert_eq!(response.grammar_notes.len(), 1);
        assert_eq!(response.vocabulary.len(), 1);
    }

    #[test]
    fn test_llm_response_empty_arrays() {
        let json = r#"{
            "translation": "Hello",
            "usage_context": [],
            "grammar_notes": [],
            "vocabulary": []
        }"#;

        let response: LLMResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.translation, "Hello");
        assert!(response.usage_context.is_empty());
        assert!(response.grammar_notes.is_empty());
        assert!(response.vocabulary.is_empty());
    }

    #[test]
    fn test_chat_completion_response_deserialization() {
        let json = r#"{
            "choices": [
                {
                    "message": {
                        "content": "{\"translation\":\"Hello\",\"usage_context\":[],\"grammar_notes\":[],\"vocabulary\":[]}"
                    }
                }
            ]
        }"#;

        let response: ChatCompletionResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.choices.len(), 1);
        assert!(response.choices[0].message.content.contains("translation"));
    }
}