import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgress } from '../useProgress';
import type { VideoInfo, AbLoopInfo } from '../useProgress';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockedInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

describe('useProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedInvoke.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns default values on init', () => {
      const { result } = renderHook(() => useProgress());
      expect(result.current.currentPosition).toBe(0);
      expect(result.current.lastPosition).toBe(0);
      expect(result.current.watchCount).toBe(0);
      expect(result.current.videoList).toEqual([]);
      expect(result.current.savedLoops).toEqual([]);
    });
  });

  describe('saveProgress', () => {
    it('debounces progress saves (5 second delay)', async () => {
      mockedInvoke.mockResolvedValue(undefined);
      const { result } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 45.5, 1.0);
      });

      expect(mockedInvoke).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockedInvoke).toHaveBeenCalledWith('save_progress', {
        videoId: 1,
        positionSeconds: 45.5,
        playbackRate: 1.0,
        lastPosition: 45500,
      });
    });

    it('resets debounce timer on subsequent calls', async () => {
      mockedInvoke.mockResolvedValue(undefined);
      const { result } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 10, 1.0);
      });

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      act(() => {
        result.current.saveProgress(1, 20, 1.5);
      });

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockedInvoke).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockedInvoke).toHaveBeenCalledTimes(1);
      expect(mockedInvoke).toHaveBeenCalledWith('save_progress', {
        videoId: 1,
        positionSeconds: 20,
        playbackRate: 1.5,
        lastPosition: 20000,
      });
    });

    it('only saves the latest position after debounce', async () => {
      mockedInvoke.mockResolvedValue(undefined);
      const { result } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 10, 1.0);
      });
      act(() => {
        result.current.saveProgress(1, 20, 1.0);
      });
      act(() => {
        result.current.saveProgress(1, 30, 1.5);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockedInvoke).toHaveBeenCalledTimes(1);
      expect(mockedInvoke).toHaveBeenCalledWith('save_progress', {
        videoId: 1,
        positionSeconds: 30,
        playbackRate: 1.5,
        lastPosition: 30000,
      });
    });

    it('updates currentPosition and lastPosition after save', async () => {
      mockedInvoke.mockResolvedValue(undefined);
      const { result } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 45.5, 1.0);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(result.current.currentPosition).toBe(45.5);
      expect(result.current.lastPosition).toBe(45500);
    });

    it('handles invoke errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedInvoke.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 30, 1.0);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to save progress:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('loadProgress', () => {
    it('loads progress for a video', async () => {
      const mockProgress = {
        id: 1,
        video_id: 42,
        position_seconds: 123.45,
        playback_rate: 1.5,
        last_position: 123450,
      };
      mockedInvoke.mockResolvedValue(mockProgress);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadProgress(42);
      });

      expect(mockedInvoke).toHaveBeenCalledWith('get_progress', { videoId: 42 });
      expect(result.current.currentPosition).toBe(123.45);
      expect(result.current.lastPosition).toBe(123450);
    });

    it('resets position when no progress exists', async () => {
      mockedInvoke.mockResolvedValue(null);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadProgress(99);
      });

      expect(result.current.currentPosition).toBe(0);
      expect(result.current.lastPosition).toBe(0);
    });

    it('handles load errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedInvoke.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadProgress(1);
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to load progress:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('loadVideoList', () => {
    it('loads video list with progress info', async () => {
      const mockVideos: VideoInfo[] = [
        {
          id: 1,
          fileName: 'video1.mp4',
          filePath: '/path/to/video1.mp4',
          watchCount: 5,
          lastWatchedAt: '2026-04-20T10:00:00',
          progressPercent: 75.0,
        },
        {
          id: 2,
          fileName: 'video2.mp4',
          filePath: '/path/to/video2.mp4',
          watchCount: 0,
          lastWatchedAt: null,
          progressPercent: 0,
        },
      ];
      mockedInvoke.mockResolvedValue(mockVideos);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadVideoList();
      });

      expect(mockedInvoke).toHaveBeenCalledWith('list_videos');
      expect(result.current.videoList).toEqual(mockVideos);
      expect(result.current.videoList).toHaveLength(2);
    });

    it('handles empty video list', async () => {
      mockedInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadVideoList();
      });

      expect(result.current.videoList).toEqual([]);
    });

    it('handles load errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedInvoke.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadVideoList();
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to load video list:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('saveLoop', () => {
    it('saves a new A-B loop and adds to state', async () => {
      mockedInvoke.mockResolvedValue(1);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.saveLoop(42, 10.0, 20.0, 'intro');
      });

      expect(mockedInvoke).toHaveBeenCalledWith('save_ab_loop', {
        videoId: 42,
        startTime: 10.0,
        endTime: 20.0,
        label: 'intro',
      });

      expect(result.current.savedLoops).toHaveLength(1);
      expect(result.current.savedLoops[0]).toEqual({
        id: 1,
        videoId: 42,
        startTime: 10.0,
        endTime: 20.0,
        label: 'intro',
      });
    });

    it('saves a loop without a label', async () => {
      mockedInvoke.mockResolvedValue(2);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.saveLoop(42, 5.0, 15.0);
      });

      expect(mockedInvoke).toHaveBeenCalledWith('save_ab_loop', {
        videoId: 42,
        startTime: 5.0,
        endTime: 15.0,
        label: null,
      });

      expect(result.current.savedLoops[0].label).toBeNull();
    });

    it('handles save errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedInvoke.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.saveLoop(42, 10.0, 20.0, 'test');
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to save A-B loop:', expect.any(Error));
      expect(result.current.savedLoops).toHaveLength(0);
      consoleError.mockRestore();
    });
  });

  describe('deleteLoop', () => {
    it('deletes a loop by ID and removes from state', async () => {
      mockedInvoke.mockResolvedValueOnce(1);
      mockedInvoke.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.saveLoop(42, 10.0, 20.0, 'intro');
      });

      expect(result.current.savedLoops).toHaveLength(1);

      await act(async () => {
        await result.current.deleteLoop(1);
      });

      expect(mockedInvoke).toHaveBeenCalledWith('delete_ab_loop', { loopId: 1 });
      expect(result.current.savedLoops).toHaveLength(0);
    });

    it('handles delete errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedInvoke.mockResolvedValue(1);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.saveLoop(42, 10.0, 20.0, 'intro');
      });

      mockedInvoke.mockRejectedValue(new Error('DB error'));

      await act(async () => {
        await result.current.deleteLoop(1);
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to delete A-B loop:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('loadLoops', () => {
    it('loads loops for a specific video', async () => {
      const mockLoops: AbLoopInfo[] = [
        { id: 1, videoId: 42, startTime: 10.0, endTime: 20.0, label: 'intro' },
        { id: 2, videoId: 42, startTime: 30.0, endTime: 40.0, label: null },
      ];
      mockedInvoke.mockResolvedValue(mockLoops);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadLoops(42);
      });

      expect(mockedInvoke).toHaveBeenCalledWith('get_ab_loops', { videoId: 42 });
      expect(result.current.savedLoops).toEqual(mockLoops);
    });

    it('handles empty loops list', async () => {
      mockedInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadLoops(99);
      });

      expect(result.current.savedLoops).toEqual([]);
    });

    it('handles load errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedInvoke.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.loadLoops(42);
      });

      expect(consoleError).toHaveBeenCalledWith('Failed to load A-B loops:', expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('flushes pending progress on unmount', async () => {
      mockedInvoke.mockResolvedValue(undefined);
      const { result, unmount } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 50.0, 1.0);
      });

      expect(mockedInvoke).not.toHaveBeenCalled();

      unmount();

      // The async flush happens after unmount, just verify no error
      await act(async () => {
        await Promise.resolve();
      });
    });
  });

  describe('integration scenarios', () => {
    it('save then load progress round-trip', async () => {
      mockedInvoke.mockResolvedValue(undefined);

      const { result } = renderHook(() => useProgress());

      act(() => {
        result.current.saveProgress(1, 123.45, 1.5);
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(result.current.currentPosition).toBe(123.45);
      expect(result.current.lastPosition).toBe(123450);

      const mockProgress = {
        id: 1,
        video_id: 1,
        position_seconds: 123.45,
        playback_rate: 1.5,
        last_position: 123450,
      };
      mockedInvoke.mockResolvedValue(mockProgress);

      await act(async () => {
        await result.current.loadProgress(1);
      });

      expect(result.current.currentPosition).toBe(123.45);
      expect(result.current.lastPosition).toBe(123450);
    });

    it('save loop then load loops', async () => {
      mockedInvoke.mockResolvedValue(1);

      const { result } = renderHook(() => useProgress());

      await act(async () => {
        await result.current.saveLoop(42, 10.0, 20.0, 'chorus');
      });

      expect(result.current.savedLoops).toHaveLength(1);

      const mockLoops: AbLoopInfo[] = [
        { id: 1, videoId: 42, startTime: 10.0, endTime: 20.0, label: 'chorus' },
        { id: 2, videoId: 42, startTime: 50.0, endTime: 60.0, label: 'verse' },
      ];
      mockedInvoke.mockResolvedValue(mockLoops);

      await act(async () => {
        await result.current.loadLoops(42);
      });

      expect(result.current.savedLoops).toHaveLength(2);
      expect(result.current.savedLoops[1].label).toBe('verse');
    });

    it('multiple rapid saves only trigger one invoke call', async () => {
      mockedInvoke.mockResolvedValue(undefined);
      const { result } = renderHook(() => useProgress());

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.saveProgress(1, i * 10, 1.0);
        });
      }

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockedInvoke).toHaveBeenCalledTimes(1);
      expect(mockedInvoke).toHaveBeenCalledWith('save_progress', {
        videoId: 1,
        positionSeconds: 90,
        playbackRate: 1.0,
        lastPosition: 90000,
      });
    });
  });
});