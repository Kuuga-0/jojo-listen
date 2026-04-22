export interface UsageContext {
  example: string;
  explanation: string;
}

export interface GrammarNote {
  point: string;
  explanation: string;
}

export interface VocabularyItem {
  word: string;
  definition: string;
  pronunciation: string;
}

export interface LLMResponse {
  translation: string;
  usage_context: UsageContext[];
  grammar_notes: GrammarNote[];
  vocabulary: VocabularyItem[];
}