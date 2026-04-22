import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaybackRate } from '../usePlaybackRate';
import { PLAYBACK_RATES } from '../../lib/player/video';

function createMockVideoElement(overrides: Partial<HTMLVideoElement> = {}) {
  const video = {
    currentTime: 0,
    duration: 100,
    paused: true,
    ended: false,
    playbackRate: 1,
    volume: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    ...overrides,
  } as unknown as HTMLVideoElement;

  return video;
}

describe('usePlaybackRate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts at 1.0x speed', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      expect(result.current.currentRate).toBe(1.0);
      expect(result.current.osdMessage).toBeNull();
    });

    it('exposes all playback rates', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      expect(result.current.rates).toEqual(PLAYBACK_RATES);
      expect(result.current.rates).toEqual([0.5, 0.75, 1.0, 1.25, 1.5]);
    });

    it('works with null video ref', () => {
      const ref = { current: null };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      expect(result.current.currentRate).toBe(1.0);
    });
  });

  describe('increaseSpeed', () => {
    it('increases speed to next preset', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      expect(result.current.currentRate).toBe(1.0);

      act(() => {
        result.current.increaseSpeed();
      });

      expect(result.current.currentRate).toBe(1.25);
      expect(video.playbackRate).toBe(1.25);
    });

    it('cycles through all speeds', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.25);

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.5);
    });

    it('stays at max speed when already at maximum', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.5);

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.5);
    });

    it('shows OSD message with new speed', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });

      expect(result.current.osdMessage).toBe('Speed: 1.25x');
    });

    it('shows max indicator when already at maximum', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      act(() => {
        result.current.increaseSpeed();
      });

      act(() => {
        result.current.increaseSpeed();
      });

      expect(result.current.osdMessage).toBe('Speed: 1.5x (max)');
    });
  });

  describe('decreaseSpeed', () => {
    it('decreases speed to previous preset', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.25);

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.0);
      expect(video.playbackRate).toBe(1.0);
    });

    it('stays at min speed when already at minimum', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.75);

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.5);

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.5);
      expect(result.current.osdMessage).toBe('Speed: 0.5x (min)');
    });

    it('cycles down through all speeds', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.75);

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.5);
    });

    it('shows OSD message with new speed', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.decreaseSpeed();
      });

      expect(result.current.osdMessage).toBe('Speed: 0.75x');
    });
  });

  describe('setSpeed', () => {
    it('sets speed to a specific valid rate', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.setSpeed(0.5);
      });

      expect(result.current.currentRate).toBe(0.5);
      expect(video.playbackRate).toBe(0.5);
      expect(result.current.osdMessage).toBe('Speed: 0.5x');
    });

    it('sets speed to each valid preset', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      for (const rate of PLAYBACK_RATES) {
        act(() => {
          result.current.setSpeed(rate as 0.5 | 0.75 | 1.0 | 1.25 | 1.5);
        });
        expect(result.current.currentRate).toBe(rate);
      }
    });

    it('ignores invalid rate values', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.setSpeed(0.8 as any);
      });

      expect(result.current.currentRate).toBe(1.0);
    });

    it('ignores negative rate values', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.setSpeed(-1 as any);
      });

      expect(result.current.currentRate).toBe(1.0);
    });
  });

  describe('OSD messages', () => {
    it('auto-dismisses OSD message after 2 seconds', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.osdMessage).toBe('Speed: 1.25x');

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.osdMessage).toBeNull();
    });

    it('replaces previous OSD message when new action occurs', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.osdMessage).toBe('Speed: 1.25x');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.osdMessage).toBe('Speed: 1.5x');

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.osdMessage).toBeNull();
    });
  });

  describe('boundary conditions', () => {
    it('can go from min to max and back', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.75);

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.5);

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(0.75);

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.0);

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.25);

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.5);
    });

    it('setSpeed works after increase/decrease', () => {
      const video = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.25);

      act(() => {
        result.current.setSpeed(0.5);
      });
      expect(result.current.currentRate).toBe(0.5);
    });

    it('works without video element (null ref)', () => {
      const ref = { current: null };
      const { result } = renderHook(() => usePlaybackRate({ videoRef: ref }));

      act(() => {
        result.current.increaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.25);

      act(() => {
        result.current.decreaseSpeed();
      });
      expect(result.current.currentRate).toBe(1.0);
    });
  });
});