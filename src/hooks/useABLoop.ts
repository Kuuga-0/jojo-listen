import { useState, useCallback, useRef, useEffect } from 'react';
import type { SubtitleCue } from '../lib/subtitle/types';

// State machine transitions:
//   idle     + setAPoint  → a_set
//   a_set    + setBPoint  → ab_set
//   a_set    + setAPoint  → a_set  (re-set A)
//   ab_set   + startLoop  → looping
//   looping  + stopLoop   → ab_set
//   looping  + clearLoop  → idle
//   ab_set   + clearLoop  → idle
//   a_set    + clearLoop  → idle
//   idle     + clearLoop  → idle   (no-op)

export type ABLoopStatus = 'idle' | 'a_set' | 'ab_set' | 'looping';

export interface ABLoopState {
  status: ABLoopStatus;
  aTime: number | null;
  bTime: number | null;
}

export interface UseABLoopOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cues?: SubtitleCue[];
}

export interface UseABLoopReturn extends ABLoopState {
  setAPoint: (time: number) => void;
  setBPoint: (time: number) => void;
  startLoop: () => void;
  stopLoop: () => void;
  clearLoop: () => void;
  osdMessage: string | null;
}

const OSD_DISPLAY_DURATION = 2000;
const LOOP_JUMP_COOLDOWN_MS = 200;
const START_MARGIN = 0.3;
const END_MARGIN = 0.5;

function snapToStartTime(time: number, cues: SubtitleCue[]): number {
  if (cues.length === 0) return time;
  let nearest = time;
  let minDist = Infinity;
  for (const cue of cues) {
    const dist = Math.abs(cue.startTime - time);
    if (dist < minDist) {
      minDist = dist;
      nearest = cue.startTime;
    }
  }
  return nearest;
}

function snapToEndTime(time: number, cues: SubtitleCue[]): number {
  if (cues.length === 0) return time;
  let nearest = time;
  let minDist = Infinity;
  for (const cue of cues) {
    const dist = Math.abs(cue.endTime - time);
    if (dist < minDist) {
      minDist = dist;
      nearest = cue.endTime;
    }
  }
  return nearest;
}

/**
 * A-B Loop hook implementing the core 100LS methodology loop feature.
 *
 * State machine: idle → a_set → ab_set → looping → idle
 * Uses dual detection (timeupdate + requestAnimationFrame) to ensure
 * the loop point is never missed, even at slow playback speeds.
 */
export function useABLoop({ videoRef, cues }: UseABLoopOptions): UseABLoopReturn {
  const [state, setState] = useState<ABLoopState>({
    status: 'idle',
    aTime: null,
    bTime: null,
  });

  const [osdMessage, setOsdMessage] = useState<string | null>(null);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJumpTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);

  const showOsd = useCallback((message: string) => {
    setOsdMessage(message);
    if (osdTimerRef.current !== null) {
      clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = setTimeout(() => {
      setOsdMessage(null);
      osdTimerRef.current = null;
    }, OSD_DISPLAY_DURATION);
  }, []);

  const setAPoint = useCallback(
    (time: number) => {
      const snappedTime = cues ? snapToStartTime(time, cues) : time;
      setState((prev) => {
        if (prev.bTime !== null && snappedTime > prev.bTime) {
          showOsd('A-B Loop: A must be before B');
          return prev;
        }
        showOsd(`A-B Loop: A = ${snappedTime.toFixed(1)}s`);
        return { ...prev, status: 'a_set', aTime: snappedTime };
      });
    },
    [cues, showOsd],
  );

  const setBPoint = useCallback(
    (time: number) => {
      const snappedTime = cues ? snapToEndTime(time, cues) : time;
      setState((prev) => {
        if (prev.aTime === null) {
          showOsd('A-B Loop: Set A point first');
          return prev;
        }
        if (snappedTime <= prev.aTime) {
          showOsd('A-B Loop: B must be after A');
          return prev;
        }
        showOsd(`A-B Loop: B = ${snappedTime.toFixed(1)}s`);
        return { ...prev, status: 'ab_set', bTime: snappedTime };
      });
    },
    [cues, showOsd],
  );

  const startLoop = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ab_set' || prev.aTime === null || prev.bTime === null) {
        return prev;
      }
      const video = videoRef.current;
      if (video) {
        video.currentTime = prev.aTime;
        lastJumpTimeRef.current = performance.now();
      }
      showOsd('A-B Loop: Looping');
      return { ...prev, status: 'looping' };
    });
  }, [videoRef, showOsd]);

  const stopLoop = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'looping') return prev;
      showOsd('A-B Loop: Stopped');
      return { ...prev, status: 'ab_set' };
    });
  }, [showOsd]);

  const clearLoop = useCallback(() => {
    setState({ status: 'idle', aTime: null, bTime: null });
    showOsd('A-B Loop: Cleared');
  }, [showOsd]);

  // Dual detection: timeupdate (~4Hz) as primary, rAF (60Hz) as secondary.
  // rAF ensures B point is never missed even at 0.5x playback speed.
  // 200ms cooldown after each loop jump prevents re-triggering.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkLoop = () => {
      setState((prev) => {
        if (prev.status !== 'looping' || prev.aTime === null || prev.bTime === null) {
          return prev;
        }

        const now = performance.now();
        if (now - lastJumpTimeRef.current < LOOP_JUMP_COOLDOWN_MS) {
          return prev;
        }

        const currentTime = video.currentTime;
        const aTime = prev.aTime;
        const bTime = prev.bTime;

        if (currentTime >= bTime - END_MARGIN) {
          video.currentTime = aTime;
          lastJumpTimeRef.current = now;
          return prev;
        }

        if (currentTime < aTime - START_MARGIN) {
          video.currentTime = aTime;
          lastJumpTimeRef.current = now;
          return prev;
        }

        return prev;
      });
    };

    const handleTimeUpdate = () => {
      checkLoop();
    };

    const tick = () => {
      checkLoop();
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const handleEnded = () => {
      setState((prev) => {
        if (prev.status === 'looping') {
          return { ...prev, status: 'ab_set' };
        }
        return prev;
      });
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [videoRef, state.status]);

  return {
    ...state,
    setAPoint,
    setBPoint,
    startLoop,
    stopLoop,
    clearLoop,
    osdMessage,
  };
}