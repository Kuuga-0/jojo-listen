import { useState, useCallback, useRef } from 'react';
import { PLAYBACK_RATES, type PlaybackRate } from '../lib/player/video';

const OSD_DISPLAY_DURATION = 2000;

export interface UsePlaybackRateOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export interface UsePlaybackRateReturn {
  currentRate: PlaybackRate;
  rates: readonly PlaybackRate[];
  increaseSpeed: () => void;
  decreaseSpeed: () => void;
  setSpeed: (rate: PlaybackRate) => void;
  osdMessage: string | null;
}

export function usePlaybackRate({ videoRef }: UsePlaybackRateOptions): UsePlaybackRateReturn {
  const [currentRate, setCurrentRate] = useState<PlaybackRate>(1.0);
  const [osdMessage, setOsdMessage] = useState<string | null>(null);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const applyRate = useCallback(
    (rate: PlaybackRate) => {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = rate;
      }
      setCurrentRate(rate);
      showOsd(`Speed: ${rate}x`);
    },
    [videoRef, showOsd],
  );

  const increaseSpeed = useCallback(() => {
    setCurrentRate((prev) => {
      const currentIndex = PLAYBACK_RATES.indexOf(prev);
      if (currentIndex >= PLAYBACK_RATES.length - 1) {
        showOsd(`Speed: ${prev}x (max)`);
        return prev;
      }
      const nextRate = PLAYBACK_RATES[currentIndex + 1];
      const video = videoRef.current;
      if (video) {
        video.playbackRate = nextRate;
      }
      showOsd(`Speed: ${nextRate}x`);
      return nextRate;
    });
  }, [videoRef, showOsd]);

  const decreaseSpeed = useCallback(() => {
    setCurrentRate((prev) => {
      const currentIndex = PLAYBACK_RATES.indexOf(prev);
      if (currentIndex <= 0) {
        showOsd(`Speed: ${prev}x (min)`);
        return prev;
      }
      const prevRate = PLAYBACK_RATES[currentIndex - 1];
      const video = videoRef.current;
      if (video) {
        video.playbackRate = prevRate;
      }
      showOsd(`Speed: ${prevRate}x`);
      return prevRate;
    });
  }, [videoRef, showOsd]);

  const setSpeed = useCallback(
    (rate: PlaybackRate) => {
      if (!PLAYBACK_RATES.includes(rate)) return;
      applyRate(rate);
    },
    [applyRate],
  );

  return {
    currentRate,
    rates: PLAYBACK_RATES,
    increaseSpeed,
    decreaseSpeed,
    setSpeed,
    osdMessage,
  };
}