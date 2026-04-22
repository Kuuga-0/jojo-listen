import { invoke } from '@tauri-apps/api/core';
import { getItem } from 'tauri-plugin-keychain';
import type { LLMResponse } from './types';

const API_KEY_ID = 'jojo-listen-api-key';

export async function analyzeSentence(
  sentence: string,
  context: string[],
): Promise<LLMResponse> {
  const apiKey = await getItem(API_KEY_ID);
  if (!apiKey) {
    throw new Error(
      `API key not found in keychain (key: ${API_KEY_ID}). Please set your API key first.`,
    );
  }

  return await invoke<LLMResponse>('analyze_sentence', {
    sentence,
    context,
    apiKey,
  });
}