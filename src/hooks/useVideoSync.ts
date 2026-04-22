import { useState, useEffect, useRef, useCallback } from 'react';
import type { SubtitleCue } from '../lib/subtitle/types';

export interface UseVideoSyncOptions {
  cues: SubtitleCue[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Minimum interval in ms between state updates (default: 100) */
  syncInterval?: number;
}

export interface UseVideoSyncReturn {
  currentTime: number;
  activeCue: SubtitleCue | null;
  /** Index of the active cue in the cues array, or -1 if none */
  activeCueIndex: number;
}

/**
 * Hook that synchronizes video playback time with subtitle cue detection.
 *
 * Uses requestAnimationFrame for smooth sync during playback,
 * with timeupdate and seeked events as fallback for seeking/paused states.
 * Updates are debounced to at most every `syncInterval` ms to avoid
 * excessive re-renders.
 */
export function useVideoSync({
  cues,
  videoRef,
  syncInterval = 100,
}: UseVideoSyncOptions): UseVideoSyncReturn {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState(-1);
  const rafIdRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef(0);

  /** Returns -1 if no cue contains the given time. */
  const findActiveCueIndex = useCallback(
    (time: number): number => {
      for (let i = 0; i < cues.length; i++) {
        if (time >= cues[i].startTime && time <= cues[i].endTime) {
          return i;
        }
      }
      return -1;
    },
    [cues],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSync = (time: number) => {
      setCurrentTime(time);
      setActiveCueIndex(findActiveCueIndex(time));
    };

    const tick = () => {
      const now = performance.now();
      if (now - lastUpdateTimeRef.current >= syncInterval) {
        updateSync(video.currentTime);
        lastUpdateTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    const handleTimeUpdate = () => {
      updateSync(video.currentTime);
    };

    const handleSeeked = () => {
      updateSync(video.currentTime);
      lastUpdateTimeRef.current = performance.now();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [cues, videoRef, syncInterval, findActiveCueIndex]);

  const activeCue: SubtitleCue | null =
    activeCueIndex >= 0 && activeCueIndex < cues.length
      ? cues[activeCueIndex]
      : null;

  return { currentTime, activeCue, activeCueIndex };
}