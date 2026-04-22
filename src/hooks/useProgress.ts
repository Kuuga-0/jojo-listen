import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface VideoInfo {
  id: number;
  fileName: string;
  filePath: string;
  watchCount: number;
  lastWatchedAt: string | null;
  progressPercent: number;
}

export interface AbLoopInfo {
  id: number;
  videoId: number;
  startTime: number;
  endTime: number;
  label: string | null;
}

export interface UseProgressReturn {
  currentPosition: number;
  lastPosition: number;
  watchCount: number;
  saveProgress: (videoId: number, position: number, playbackRate: number) => void;
  loadProgress: (videoId: number) => Promise<void>;
  videoList: VideoInfo[];
  loadVideoList: () => Promise<void>;
  savedLoops: AbLoopInfo[];
  saveLoop: (videoId: number, startTime: number, endTime: number, label?: string) => void;
  deleteLoop: (loopId: number) => void;
  loadLoops: (videoId: number) => Promise<void>;
}

const DEBOUNCE_MS = 5000;

export function useProgress(): UseProgressReturn {
  const [currentPosition, setCurrentPosition] = useState(0);
  const [lastPosition, setLastPosition] = useState(0);
  const [watchCount] = useState(0);
  const [videoList, setVideoList] = useState<VideoInfo[]>([]);
  const [savedLoops, setSavedLoops] = useState<AbLoopInfo[]>([]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ videoId: number; position: number; playbackRate: number } | null>(null);

  const flushProgress = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;

    try {
      await invoke('save_progress', {
        videoId: pending.videoId,
        positionSeconds: pending.position,
        playbackRate: pending.playbackRate,
        lastPosition: Math.floor(pending.position * 1000),
      });
      setCurrentPosition(pending.position);
      setLastPosition(Math.floor(pending.position * 1000));
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, []);

  const saveProgress = useCallback(
    (videoId: number, position: number, playbackRate: number) => {
      pendingSaveRef.current = { videoId, position, playbackRate };

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushProgress();
      }, DEBOUNCE_MS);
    },
    [flushProgress],
  );

  const loadProgress = useCallback(async (videoId: number) => {
    try {
      const result = await invoke<{
        id: number;
        video_id: number;
        position_seconds: number;
        playback_rate: number;
        last_position: number;
      } | null>('get_progress', { videoId });

      if (result) {
        setCurrentPosition(result.position_seconds);
        setLastPosition(result.last_position);
      } else {
        setCurrentPosition(0);
        setLastPosition(0);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  }, []);

  const loadVideoList = useCallback(async () => {
    try {
      const videos = await invoke<VideoInfo[]>('list_videos');
      setVideoList(videos);
    } catch (error) {
      console.error('Failed to load video list:', error);
    }
  }, []);

  const saveLoop = useCallback(
    async (videoId: number, startTime: number, endTime: number, label?: string) => {
      try {
        const loopId = await invoke<number>('save_ab_loop', {
          videoId,
          startTime,
          endTime,
          label: label ?? null,
        });
        setSavedLoops((prev) => [
          ...prev,
          { id: loopId, videoId, startTime, endTime, label: label ?? null },
        ]);
      } catch (error) {
        console.error('Failed to save A-B loop:', error);
      }
    },
    [],
  );

  const deleteLoop = useCallback(async (loopId: number) => {
    try {
      await invoke('delete_ab_loop', { loopId });
      setSavedLoops((prev) => prev.filter((loop) => loop.id !== loopId));
    } catch (error) {
      console.error('Failed to delete A-B loop:', error);
    }
  }, []);

  const loadLoops = useCallback(async (videoId: number) => {
    try {
      const loops = await invoke<AbLoopInfo[]>('get_ab_loops', { videoId });
      setSavedLoops(loops);
    } catch (error) {
      console.error('Failed to load A-B loops:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      flushProgress();
    };
  }, [flushProgress]);

  return {
    currentPosition,
    lastPosition,
    watchCount,
    saveProgress,
    loadProgress,
    videoList,
    loadVideoList,
    savedLoops,
    saveLoop,
    deleteLoop,
    loadLoops,
  };
}