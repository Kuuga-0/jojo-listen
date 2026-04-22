import { useMemo, useCallback } from 'react';
import type { SubtitleCue } from '../lib/subtitle/types';
import { segmentWords, type WordSegment } from '../lib/subtitle/segmenter';

export type DisplayMode =
  | 'word-segmented'
  | 'word-segmented-translation'
  | 'plain'
  | 'plain-translation';

export interface SubtitleRendererProps {
  /** Array of subtitle cues */
  cues: SubtitleCue[];
  /** Index of the currently active cue (-1 if none) */
  activeCueIndex: number;
  /** Current playback time in seconds */
  currentTime: number;
  /** Display mode for subtitles */
  displayMode: DisplayMode;
  /** Callback when a word is clicked (only in word-segmented modes) */
  onWordClick?: (word: string, cue: SubtitleCue) => void;
  /** Map of sentence text to translation (from LLM) */
  translationMap?: Map<string, string>;
}

interface WordSegmentWithTiming extends WordSegment {
  /** Start time of this word within the cue's time range */
  wordStartTime: number;
  /** End time of this word within the cue's time range */
  wordEndTime: number;
}

/**
 * Calculate word timing based on cue duration and word position.
 * Words are distributed evenly across the cue's time range.
 */
function calculateWordTiming(
  segments: WordSegment[],
  cueStartTime: number,
  cueEndTime: number,
): WordSegmentWithTiming[] {
  const wordSegments = segments.filter((s) => !s.isPunctuation);
  const wordCount = wordSegments.length;

  if (wordCount === 0) {
    return segments.map((s) => ({
      ...s,
      wordStartTime: cueStartTime,
      wordEndTime: cueEndTime,
    }));
  }

  const cueDuration = cueEndTime - cueStartTime;
  const wordDuration = cueDuration / wordCount;

  let wordIndex = 0;
  return segments.map((s) => {
    if (s.isPunctuation) {
      const prevWordEnd =
        wordIndex > 0
          ? cueStartTime + wordIndex * wordDuration
          : cueStartTime;
      return {
        ...s,
        wordStartTime: prevWordEnd,
        wordEndTime: prevWordEnd,
      };
    }

    const wordStartTime = cueStartTime + wordIndex * wordDuration;
    const wordEndTime = wordStartTime + wordDuration;
    wordIndex++;

    return {
      ...s,
      wordStartTime,
      wordEndTime,
    };
  });
}

/**
 * Find the index of the word that is currently active based on currentTime.
 * Returns -1 if no word is active.
 */
function findActiveWordIndex(
  segmentsWithTiming: WordSegmentWithTiming[],
  currentTime: number,
): number {
  for (let i = 0; i < segmentsWithTiming.length; i++) {
    const seg = segmentsWithTiming[i];
    if (!seg.isPunctuation && currentTime >= seg.wordStartTime && currentTime < seg.wordEndTime) {
      return i;
    }
  }
  return -1;
}

/**
 * SubtitleRenderer component displays subtitles in 4 different modes,
 * synced with video playback time.
 */
export function SubtitleRenderer({
  cues,
  activeCueIndex,
  currentTime,
  displayMode,
  onWordClick,
  translationMap,
}: SubtitleRendererProps) {
  const activeCue =
    activeCueIndex >= 0 && activeCueIndex < cues.length
      ? cues[activeCueIndex]
      : null;

  const nextCueIndex = useMemo(() => {
    if (activeCueIndex < 0) return -1;
    const nextIndex = activeCueIndex + 1;
    return nextIndex < cues.length ? nextIndex : -1;
  }, [activeCueIndex, cues.length]);

  const wordSegments = useMemo(() => {
    if (!activeCue) return [];
    return segmentWords(activeCue.text);
  }, [activeCue]);

  const segmentsWithTiming = useMemo(() => {
    if (!activeCue || wordSegments.length === 0) return [];
    return calculateWordTiming(wordSegments, activeCue.startTime, activeCue.endTime);
  }, [activeCue, wordSegments]);

  const activeWordIndex = useMemo(() => {
    if (segmentsWithTiming.length === 0) return -1;
    return findActiveWordIndex(segmentsWithTiming, currentTime);
  }, [segmentsWithTiming, currentTime]);

  const translation = useMemo(() => {
    if (!activeCue || !translationMap) return null;
    return translationMap.get(activeCue.text) ?? null;
  }, [activeCue, translationMap]);

  const handleWordClick = useCallback(
    (word: string) => {
      if (activeCue && onWordClick) {
        onWordClick(word, activeCue);
      }
    },
    [activeCue, onWordClick],
  );

  const showContent = activeCue !== null;

  const isWordSegmented =
    displayMode === 'word-segmented' ||
    displayMode === 'word-segmented-translation';

  const showTranslation =
    displayMode === 'word-segmented-translation' ||
    displayMode === 'plain-translation';

  const renderWordSegmented = () => {
    if (!activeCue || segmentsWithTiming.length === 0) return null;

    return (
      <div style={styles.wordContainer}>
        {segmentsWithTiming.map((seg, index) => {
          const isActive = index === activeWordIndex;
          const isClickable = !seg.isPunctuation && onWordClick;

          return (
            <span
              key={`${seg.startIndex}-${seg.endIndex}`}
              style={{
                ...styles.word,
                ...(seg.isPunctuation ? styles.punctuation : {}),
                ...(isActive ? styles.activeWord : {}),
                ...(isClickable ? styles.clickableWord : {}),
              }}
              onClick={isClickable ? () => handleWordClick(seg.word) : undefined}
              data-testid={seg.isPunctuation ? 'punctuation' : 'word'}
              data-active={isActive ? 'true' : 'false'}
            >
              {seg.word}
            </span>
          );
        })}
      </div>
    );
  };

  const renderPlain = () => {
    if (!activeCue) return null;
    return (
      <div style={styles.plainContainer} data-testid="plain-text">
        {activeCue.text}
      </div>
    );
  };

  const renderTranslation = () => {
    if (!translation) return null;
    return (
      <div style={styles.translationContainer} data-testid="translation-text">
        {translation}
      </div>
    );
  };

  return (
    <div
      style={{
        ...styles.container,
        ...(showContent ? styles.visible : styles.hidden),
      }}
      data-testid="subtitle-renderer"
      data-display-mode={displayMode}
      data-active-cue-index={activeCueIndex}
      data-next-cue-index={nextCueIndex}
    >
      {showContent && (
        <>
          {isWordSegmented ? renderWordSegmented() : renderPlain()}
          {showTranslation && renderTranslation()}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    padding: '12px 20px',
    backgroundColor: 'var(--overlay)',
    borderRadius: '8px',
    textAlign: 'center',
    transition: 'opacity 200ms ease-in-out',
    zIndex: 10,
  },
  visible: {
    opacity: 1,
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  wordContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '4px',
  },
  word: {
    display: 'inline-block',
    padding: '2px 4px',
    fontSize: '24px',
    lineHeight: '1.4',
    color: 'var(--text-primary)',
    borderRadius: '4px',
    transition: 'background-color 150ms ease, color 150ms ease',
  },
  punctuation: {
    color: 'var(--text-secondary)',
    padding: '2px 1px',
  },
  activeWord: {
    backgroundColor: 'var(--accent)',
    color: 'var(--text-primary)',
  },
  clickableWord: {
    cursor: 'pointer',
  },
  plainContainer: {
    fontSize: '24px',
    lineHeight: '1.4',
    color: 'var(--text-primary)',
  },
  translationContainer: {
    marginTop: '8px',
    fontSize: '16px',
    lineHeight: '1.3',
    color: 'var(--text-secondary)',
  },
};

export default SubtitleRenderer;
