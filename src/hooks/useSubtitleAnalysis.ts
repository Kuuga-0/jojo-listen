import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { LLMResponse } from '../lib/llm/types';
import type { SubtitleCue } from '../lib/subtitle/types';
import { analyzeSentence } from '../lib/llm/api';

/**
 * Return type for the useSubtitleAnalysis hook.
 */
export interface UseSubtitleAnalysisReturn {
  /** The LLM analysis response, or null if no analysis has been performed. */
  analysisResponse: LLMResponse | null;
  /** Whether an analysis request is currently in progress. */
  isLoading: boolean;
  /** Error message if the analysis failed, or null. */
  error: string | null;
  /** The subtitle cue that is currently being analyzed, or null. */
  activeAnalysisCue: SubtitleCue | null;
  /** Analyze a word click: pauses video, builds context, and triggers analysis. */
  analyzeWord: (word: string, cue: SubtitleCue, allCues: SubtitleCue[]) => void;
  /** Analyze a sentence directly with provided context. */
  analyzeSentence: (sentence: string, context: string[]) => void;
  /** Close the analysis card and clear all state. */
  closeAnalysis: () => void;
  /** Retry the last failed analysis request. */
  retry: () => void;
}

/**
 * Options for the useSubtitleAnalysis hook.
 */
export interface UseSubtitleAnalysisOptions {
  /** Callback to pause the video when a word is clicked. */
  onPauseVideo?: () => void;
}

/** Number of context cues to include before and after the active cue. */
const CONTEXT_WINDOW = 2;

/**
 * Simple hash function for generating cache keys from sentence text.
 * Uses DJB2 algorithm for fast, deterministic hashing.
 */
function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(16);
}

/**
 * Build context strings from surrounding subtitle cues.
 * Takes CONTEXT_WINDOW cues before and after the active cue.
 */
function buildContext(cue: SubtitleCue, allCues: SubtitleCue[]): string[] {
  const cueIndex = allCues.findIndex((c) => c.id === cue.id);
  if (cueIndex === -1) {
    return [cue.text];
  }

  const startIndex = Math.max(0, cueIndex - CONTEXT_WINDOW);
  const endIndex = Math.min(allCues.length - 1, cueIndex + CONTEXT_WINDOW);

  const contextCues: SubtitleCue[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    contextCues.push(allCues[i]);
  }

  return contextCues.map((c) => c.text);
}

/**
 * Hook that manages the subtitle click → LLM analysis flow.
 *
 * Features:
 * - Click word → pause video → build context → call LLM
 * - Cache: checks llm_cache table via Tauri invoke before making request
 * - Deduplication: concurrent clicks on same sentence only send one request
 * - State transitions: idle → loading → success/error
 * - Error handling with retry
 * - Close analysis clears all state
 */
export function useSubtitleAnalysis(
  options: UseSubtitleAnalysisOptions = {},
): UseSubtitleAnalysisReturn {
  const { onPauseVideo } = options;

  const [analysisResponse, setAnalysisResponse] = useState<LLMResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAnalysisCue, setActiveAnalysisCue] = useState<SubtitleCue | null>(null);

  // In-flight request deduplication: sentence hash → Promise
  const inFlightRequests = useRef<Map<string, Promise<LLMResponse>>>(new Map());

  // Last request parameters for retry
  const lastRequestRef = useRef<{ sentence: string; context: string[] } | null>(null);

  const performAnalysis = useCallback(
    async (sentence: string, context: string[], cue: SubtitleCue | null) => {
      const cacheKey = hashText(sentence);

      // Check cache via Tauri invoke first (fast path, no async state needed)
      try {
        const cached = await invoke<{ llm_response_json: string } | null>(
          'get_llm_cache',
          { subtitleTextHash: cacheKey },
        );
        if (cached?.llm_response_json) {
          const response: LLMResponse = JSON.parse(cached.llm_response_json);
          setAnalysisResponse(response);
          setActiveAnalysisCue(cue);
          return;
        }
      } catch {
        // Cache lookup failed; proceed with LLM request
      }

      // Check for in-flight deduplication
      const existingRequest = inFlightRequests.current.get(cacheKey);
      if (existingRequest) {
        try {
          const response = await existingRequest;
          setAnalysisResponse(response);
          setActiveAnalysisCue(cue);
          return;
        } catch {
          // The in-flight request failed; fall through to try again
        }
      }

      // Set loading state and make the request
      setIsLoading(true);
      setError(null);
      setActiveAnalysisCue(cue);

      const requestPromise = analyzeSentence(sentence, context)
        .then((response) => {
          // Save to cache asynchronously (fire and forget)
          void invoke('save_llm_cache', {
            subtitleTextHash: cacheKey,
            llmResponseJson: JSON.stringify(response),
          });

          setAnalysisResponse(response);
          setIsLoading(false);
          inFlightRequests.current.delete(cacheKey);
          return response;
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Analysis failed. Please try again.';
          setError(message);
          setIsLoading(false);
          inFlightRequests.current.delete(cacheKey);
          throw err;
        });

      inFlightRequests.current.set(cacheKey, requestPromise);

      try {
        await requestPromise;
      } catch {
        // Error already handled above
      }
    },
    [],
  );

  const analyzeWord = useCallback(
    (_word: string, cue: SubtitleCue, allCues: SubtitleCue[]) => {
      // Pause video when user clicks a word
      onPauseVideo?.();

      const context = buildContext(cue, allCues);
      const sentence = cue.text;

      lastRequestRef.current = { sentence, context };
      void performAnalysis(sentence, context, cue);
    },
    [onPauseVideo, performAnalysis],
  );

  const analyzeSentenceDirect = useCallback(
    (sentence: string, context: string[]) => {
      lastRequestRef.current = { sentence, context };
      void performAnalysis(sentence, context, null);
    },
    [performAnalysis],
  );

  const closeAnalysis = useCallback(() => {
    setAnalysisResponse(null);
    setIsLoading(false);
    setError(null);
    setActiveAnalysisCue(null);
  }, []);

  const retry = useCallback(() => {
    if (!lastRequestRef.current) return;

    const { sentence, context } = lastRequestRef.current;
    // Clear previous error/response but keep the active cue
    setError(null);
    setAnalysisResponse(null);
    void performAnalysis(sentence, context, activeAnalysisCue);
  }, [performAnalysis, activeAnalysisCue]);

  return {
    analysisResponse,
    isLoading,
    error,
    activeAnalysisCue,
    analyzeWord,
    analyzeSentence: analyzeSentenceDirect,
    closeAnalysis,
    retry,
  };
}