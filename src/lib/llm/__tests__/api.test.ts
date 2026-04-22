import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeSentence } from '../api';
import type { LLMResponse } from '../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('tauri-plugin-keychain', () => ({
  getItem: vi.fn(),
}));

const MOCK_LLM_RESPONSE: LLMResponse = {
  translation: 'I am a student',
  usage_context: [
    {
      example: '私は学生です。よろしくお願いします。',
      explanation: 'Self-introduction pattern',
    },
  ],
  grammar_notes: [
    {
      point: 'は (wa) topic marker',
      explanation: 'Marks "I" as the topic of the sentence',
    },
  ],
  vocabulary: [
    {
      word: '私',
      definition: 'I, me',
      pronunciation: '/watashi/',
    },
    {
      word: '学生',
      definition: 'student',
      pronunciation: '/gakusee/',
    },
  ],
};

describe('analyzeSentence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call invoke with correct parameters after retrieving API key', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const { getItem } = await import('tauri-plugin-keychain');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockResolvedValue('sk-test-api-key');
    mockInvoke.mockResolvedValue(MOCK_LLM_RESPONSE);

    const result = await analyzeSentence('私は学生です', ['昨日の話ですが']);

    expect(mockGetItem).toHaveBeenCalledWith('jojo-listen-api-key');
    expect(mockInvoke).toHaveBeenCalledWith('analyze_sentence', {
      sentence: '私は学生です',
      context: ['昨日の話ですが'],
      apiKey: 'sk-test-api-key',
    });
    expect(result).toEqual(MOCK_LLM_RESPONSE);
  });

  it('should throw error when API key is not found in keychain', async () => {
    const { getItem } = await import('tauri-plugin-keychain');
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockResolvedValue(null);

    await expect(analyzeSentence('test', [])).rejects.toThrow(
      'API key not found in keychain',
    );
  });

  it('should throw error when API key is empty string', async () => {
    const { getItem } = await import('tauri-plugin-keychain');
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockResolvedValue('');

    await expect(analyzeSentence('test', [])).rejects.toThrow(
      'API key not found in keychain',
    );
  });

  it('should pass empty context array when no context provided', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const { getItem } = await import('tauri-plugin-keychain');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockResolvedValue('sk-test-key');
    mockInvoke.mockResolvedValue(MOCK_LLM_RESPONSE);

    await analyzeSentence('Hello', []);

    expect(mockInvoke).toHaveBeenCalledWith('analyze_sentence', {
      sentence: 'Hello',
      context: [],
      apiKey: 'sk-test-key',
    });
  });

  it('should propagate invoke errors', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const { getItem } = await import('tauri-plugin-keychain');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockResolvedValue('sk-test-key');
    mockInvoke.mockRejectedValue(new Error('API request failed'));

    await expect(analyzeSentence('test', [])).rejects.toThrow(
      'API request failed',
    );
  });

  it('should propagate keychain errors', async () => {
    const { getItem } = await import('tauri-plugin-keychain');
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockRejectedValue(new Error('Keychain access denied'));

    await expect(analyzeSentence('test', [])).rejects.toThrow(
      'Keychain access denied',
    );
  });

  it('should return LLMResponse with all fields', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const { getItem } = await import('tauri-plugin-keychain');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    const mockGetItem = getItem as ReturnType<typeof vi.fn>;

    mockGetItem.mockResolvedValue('sk-test-key');
    mockInvoke.mockResolvedValue(MOCK_LLM_RESPONSE);

    const result = await analyzeSentence('私は学生です', []);

    expect(result.translation).toBe('I am a student');
    expect(result.usage_context).toHaveLength(1);
    expect(result.grammar_notes).toHaveLength(1);
    expect(result.vocabulary).toHaveLength(2);
    expect(result.vocabulary[0].word).toBe('私');
    expect(result.vocabulary[0].pronunciation).toBe('/watashi/');
  });
});