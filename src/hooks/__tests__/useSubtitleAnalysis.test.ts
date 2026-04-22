import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubtitleAnalysis } from '../useSubtitleAnalysis';
import type { SubtitleCue } from '../../lib/subtitle/types';
import type { LLMResponse } from '../../lib/llm/types';

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock tauri-plugin-keychain
vi.mock('tauri-plugin-keychain', () => ({
  getItem: vi.fn().mockResolvedValue('test-api-key'),
}));

// Mock analyzeSentence from the LLM API module
const mockAnalyzeSentence = vi.fn();
vi.mock('../../lib/llm/api', () => ({
  analyzeSentence: (...args: unknown[]) => mockAnalyzeSentence(...args),
}));

function createCue(
  id: string,
  startTime: number,
  endTime: number,
  text: string,
): SubtitleCue {
  return { id, startTime, endTime, text, originalText: text };
}

const SAMPLE_CUES: SubtitleCue[] = [
  createCue('1', 0, 3, 'Hello there'),
  createCue('2', 3, 6, 'How are you doing today'),
  createCue('3', 6, 9, 'I am learning English'),
  createCue('4', 9, 12, 'This is a great day'),
  createCue('5', 12, 15, 'Thank you very much'),
];

const SAMPLE_RESPONSE: LLMResponse = {
  translation: '你好',
  usage_context: [{ example: 'How are you doing today', explanation: 'Common greeting' }],
  grammar_notes: [{ point: 'Present continuous', explanation: 'Used for ongoing actions' }],
  vocabulary: [{ word: 'doing', definition: 'performing an action', pronunciation: '/duːɪŋ/' }],
};

describe('useSubtitleAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    mockAnalyzeSentence.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns null response, not loading, no error, no active cue', () => {
      const { result } = renderHook(() => useSubtitleAnalysis());

      expect(result.current.analysisResponse).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.activeAnalysisCue).toBeNull();
    });
  });

  describe('analyzeWord', () => {
    it('pauses video via callback when word is clicked', () => {
      const onPauseVideo = vi.fn();
      const { result } = renderHook(() =>
        useSubtitleAnalysis({ onPauseVideo }),
      );

      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      act(() => {
        result.current.analyzeWord('doing', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      expect(onPauseVideo).toHaveBeenCalledTimes(1);
    });

    it('does not call onPauseVideo when not provided', () => {
      const { result } = renderHook(() => useSubtitleAnalysis());

      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      act(() => {
        result.current.analyzeWord('doing', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      // No crash, no error
      expect(result.current.error).toBeNull();
    });

    it('builds context with 2 cues before and after the active cue', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Click on cue index 2 ("I am learning English")
      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      // Context should include cues 0-4 (2 before + active + 2 after)
      expect(mockAnalyzeSentence).toHaveBeenCalledWith(
        'I am learning English',
        ['Hello there', 'How are you doing today', 'I am learning English', 'This is a great day', 'Thank you very much'],
      );
    });

    it('handles context at the beginning of the cue list', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Click on cue index 0 ("Hello there") - only 2 cues after, none before
      await act(async () => {
        result.current.analyzeWord('Hello', SAMPLE_CUES[0], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith(
        'Hello there',
        ['Hello there', 'How are you doing today', 'I am learning English'],
      );
    });

    it('handles context at the end of the cue list', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Click on cue index 4 ("Thank you very much") - only 2 cues before, none after
      await act(async () => {
        result.current.analyzeWord('much', SAMPLE_CUES[4], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith(
        'Thank you very much',
        ['I am learning English', 'This is a great day', 'Thank you very much'],
      );
    });

    it('handles cue not found in allCues (falls back to single cue)', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      const orphanCue = createCue('orphan', 20, 23, 'Orphan cue');

      await act(async () => {
        result.current.analyzeWord('Orphan', orphanCue, SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith('Orphan cue', ['Orphan cue']);
    });

    it('sets activeAnalysisCue to the clicked cue', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.activeAnalysisCue).toEqual(SAMPLE_CUES[2]);
      });
    });
  });

  describe('analyzeSentence (direct)', () => {
    it('calls analyzeSentence with provided sentence and context', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeSentence('Hello world', ['Context 1', 'Context 2']);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith('Hello world', ['Context 1', 'Context 2']);
    });

    it('does not set activeAnalysisCue (null) for direct sentence analysis', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeSentence('Hello world', ['Context 1']);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(result.current.activeAnalysisCue).toBeNull();
    });
  });

  describe('cache hit', () => {
    it('returns cached response immediately without loading state', async () => {
      const cachedResponse = JSON.stringify(SAMPLE_RESPONSE);
      mockInvoke.mockResolvedValue({ llm_response_json: cachedResponse });

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      // Should not have called analyzeSentence (cache hit)
      expect(mockAnalyzeSentence).not.toHaveBeenCalled();
      // Should have the cached response
      expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
      // Should never have been in loading state
      expect(result.current.isLoading).toBe(false);
    });

    it('uses sentence text hash as cache key', async () => {
      mockInvoke.mockResolvedValue({ llm_response_json: JSON.stringify(SAMPLE_RESPONSE) });

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      // Verify invoke was called with the hash of the sentence text
      expect(mockInvoke).toHaveBeenCalledWith('get_llm_cache', {
        subtitleTextHash: expect.any(String),
      });
    });
  });

  describe('cache miss → LLM request', () => {
    it('sets loading state while request is in progress', async () => {
      let resolveAnalysis: (value: LLMResponse) => void;
      mockInvoke.mockResolvedValue(null); // cache miss
      mockAnalyzeSentence.mockImplementation(
        () => new Promise<LLMResponse>((resolve) => { resolveAnalysis = resolve; }),
      );

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
        // Allow async state updates to settle
        await Promise.resolve();
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.analysisResponse).toBeNull();

      // Resolve the request
      await act(async () => {
        resolveAnalysis!(SAMPLE_RESPONSE);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
    });

    it('saves response to cache after successful LLM call', async () => {
      mockInvoke.mockResolvedValue(null); // cache miss
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      // Should have called invoke to save to cache
      expect(mockInvoke).toHaveBeenCalledWith(
        'save_llm_cache',
        expect.objectContaining({
          subtitleTextHash: expect.any(String),
          llmResponseJson: expect.any(String),
        }),
      );
    });

    it('does not fail if cache save fails', async () => {
      mockInvoke
        .mockResolvedValueOnce(null) // cache miss (get_llm_cache)
        .mockRejectedValueOnce(new Error('Cache write failed')); // save_llm_cache fails
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('request deduplication', () => {
    it('concurrent clicks on same sentence only send one request', async () => {
      let resolveAnalysis: (value: LLMResponse) => void;
      mockInvoke.mockResolvedValue(null); // cache miss
      mockAnalyzeSentence.mockImplementation(
        () => new Promise<LLMResponse>((resolve) => { resolveAnalysis = resolve; }),
      );

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Click twice on the same cue (same sentence text)
      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
        await Promise.resolve();
      });
      await act(async () => {
        result.current.analyzeWord('am', SAMPLE_CUES[2], SAMPLE_CUES);
        await Promise.resolve();
      });

      // Only one LLM call should have been made
      expect(mockAnalyzeSentence).toHaveBeenCalledTimes(1);

      // Resolve the request
      await act(async () => {
        resolveAnalysis!(SAMPLE_RESPONSE);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
      });
    });

    it('different sentences send separate requests', async () => {
      mockInvoke.mockResolvedValue(null); // cache miss
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Click on different cues (different sentence text)
      await act(async () => {
        result.current.analyzeWord('Hello', SAMPLE_CUES[0], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      // Reset for second call
      mockAnalyzeSentence.mockResolvedValue({
        ...SAMPLE_RESPONSE,
        translation: 'Second response',
      });

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse?.translation).toBe('Second response');
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('sets error state when LLM request fails', async () => {
      mockInvoke.mockResolvedValue(null); // cache miss
      mockAnalyzeSentence.mockRejectedValue(new Error('API key not found'));

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('API key not found');
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.analysisResponse).toBeNull();
    });

    it('handles non-Error thrown values', async () => {
      mockInvoke.mockResolvedValue(null); // cache miss
      mockAnalyzeSentence.mockRejectedValue('string error');

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Analysis failed. Please try again.');
      });
    });

    it('handles cache lookup error gracefully (proceeds with LLM request)', async () => {
      mockInvoke.mockRejectedValue(new Error('DB error')); // cache lookup fails
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('retry', () => {
    it('retries the last failed request', async () => {
      mockInvoke.mockResolvedValue(null); // cache miss

      const { result } = renderHook(() => useSubtitleAnalysis());

      // First call fails
      mockAnalyzeSentence.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Retry succeeds
      mockAnalyzeSentence.mockResolvedValueOnce(SAMPLE_RESPONSE);

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('does nothing if no previous request exists', () => {
      const { result } = renderHook(() => useSubtitleAnalysis());

      act(() => {
        result.current.retry();
      });

      expect(mockAnalyzeSentence).not.toHaveBeenCalled();
      expect(result.current.analysisResponse).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('preserves activeAnalysisCue during retry', async () => {
      mockInvoke.mockResolvedValue(null);

      const { result } = renderHook(() => useSubtitleAnalysis());

      // First call fails
      mockAnalyzeSentence.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
      expect(result.current.activeAnalysisCue).toEqual(SAMPLE_CUES[2]);

      // Retry succeeds
      mockAnalyzeSentence.mockResolvedValueOnce(SAMPLE_RESPONSE);

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
      });
      expect(result.current.activeAnalysisCue).toEqual(SAMPLE_CUES[2]);
    });
  });

  describe('closeAnalysis', () => {
    it('clears all state', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      act(() => {
        result.current.closeAnalysis();
      });

      expect(result.current.analysisResponse).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.activeAnalysisCue).toBeNull();
    });

    it('clears error state', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      act(() => {
        result.current.closeAnalysis();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('loading state transitions', () => {
    it('transitions: idle → loading → success', async () => {
      let resolveAnalysis: (value: LLMResponse) => void;
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockImplementation(
        () => new Promise<LLMResponse>((resolve) => { resolveAnalysis = resolve; }),
      );

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Initially idle
      expect(result.current.isLoading).toBe(false);
      expect(result.current.analysisResponse).toBeNull();

      // Start analysis
      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
        // Allow async state updates to settle
        await Promise.resolve();
      });

      // Loading
      expect(result.current.isLoading).toBe(true);

      // Resolve
      await act(async () => {
        resolveAnalysis!(SAMPLE_RESPONSE);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.analysisResponse).toEqual(SAMPLE_RESPONSE);
    });

    it('transitions: idle → loading → error', async () => {
      let rejectAnalysis: (reason: Error) => void;
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockImplementation(
        () => new Promise<LLMResponse>((_, reject) => { rejectAnalysis = reject; }),
      );

      const { result } = renderHook(() => useSubtitleAnalysis());

      // Start analysis
      await act(async () => {
        result.current.analyzeWord('learning', SAMPLE_CUES[2], SAMPLE_CUES);
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(true);

      // Reject
      await act(async () => {
        rejectAnalysis!(new Error('Server error'));
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.error).toBe('Server error');
      expect(result.current.analysisResponse).toBeNull();
    });
  });

  describe('context building', () => {
    it('with exactly 2 cues before and after', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const cues = [
        createCue('1', 0, 3, 'First'),
        createCue('2', 3, 6, 'Second'),
        createCue('3', 6, 9, 'Third'),
        createCue('4', 9, 12, 'Fourth'),
        createCue('5', 12, 15, 'Fifth'),
      ];

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('word', cues[2], cues);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith(
        'Third',
        ['First', 'Second', 'Third', 'Fourth', 'Fifth'],
      );
    });

    it('with single cue (no neighbors)', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const singleCue = createCue('1', 0, 3, 'Only cue');

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('Only', singleCue, [singleCue]);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith('Only cue', ['Only cue']);
    });

    it('with 2 cues total', async () => {
      mockInvoke.mockResolvedValue(null);
      mockAnalyzeSentence.mockResolvedValue(SAMPLE_RESPONSE);

      const cues = [
        createCue('1', 0, 3, 'First'),
        createCue('2', 3, 6, 'Second'),
      ];

      const { result } = renderHook(() => useSubtitleAnalysis());

      await act(async () => {
        result.current.analyzeWord('First', cues[0], cues);
      });

      await waitFor(() => {
        expect(result.current.analysisResponse).not.toBeNull();
      });

      expect(mockAnalyzeSentence).toHaveBeenCalledWith('First', ['First', 'Second']);
    });
  });
});