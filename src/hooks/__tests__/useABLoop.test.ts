import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useABLoop } from '../useABLoop';
import type { SubtitleCue } from '../../lib/subtitle/types';

function createMockVideoElement(overrides: Partial<HTMLVideoElement> = {}) {
  const listeners: Record<string, EventListener[]> = {};

  const video = {
    currentTime: 0,
    duration: 100,
    paused: true,
    ended: false,
    playbackRate: 1,
    volume: 1,
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: EventListener) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    ...overrides,
  } as unknown as HTMLVideoElement;

  return { video, listeners };
}

function createCue(
  id: string,
  startTime: number,
  endTime: number,
  text: string,
): SubtitleCue {
  return { id, startTime, endTime, text, originalText: text };
}

describe('useABLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts in idle state with null A and B times', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      expect(result.current.status).toBe('idle');
      expect(result.current.aTime).toBeNull();
      expect(result.current.bTime).toBeNull();
      expect(result.current.osdMessage).toBeNull();
    });

    it('starts in idle state when video ref is null', () => {
      const ref = { current: null };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      expect(result.current.status).toBe('idle');
      expect(result.current.aTime).toBeNull();
      expect(result.current.bTime).toBeNull();
    });
  });

  describe('setAPoint', () => {
    it('transitions from idle to a_set', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });

      expect(result.current.status).toBe('a_set');
      expect(result.current.aTime).toBe(5.0);
      expect(result.current.bTime).toBeNull();
    });

    it('shows OSD message with A point time', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });

      expect(result.current.osdMessage).toBe('A-B Loop: A = 5.0s');
    });

    it('can re-set A point when already in a_set state', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      expect(result.current.aTime).toBe(5.0);

      act(() => {
        result.current.setAPoint(8.0);
      });
      expect(result.current.status).toBe('a_set');
      expect(result.current.aTime).toBe(8.0);
    });

    it('rejects A point if it is after existing B point', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      expect(result.current.status).toBe('ab_set');

      act(() => {
        result.current.setAPoint(15.0);
      });

      expect(result.current.aTime).toBe(5.0);
      expect(result.current.bTime).toBe(10.0);
      expect(result.current.osdMessage).toBe('A-B Loop: A must be before B');
    });

    it('snaps to nearest subtitle start time when cues provided', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const cues: SubtitleCue[] = [
        createCue('1', 0, 3, 'First'),
        createCue('2', 3, 7, 'Second'),
        createCue('3', 7, 10, 'Third'),
      ];

      const { result } = renderHook(() =>
        useABLoop({ videoRef: ref, cues }),
      );

      act(() => {
        result.current.setAPoint(4.5);
      });

      expect(result.current.aTime).toBe(3.0);
    });

    it('uses exact time when no cues provided', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };

      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(4.567);
      });

      expect(result.current.aTime).toBe(4.567);
    });
  });

  describe('setBPoint', () => {
    it('transitions from a_set to ab_set', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });

      expect(result.current.status).toBe('ab_set');
      expect(result.current.aTime).toBe(5.0);
      expect(result.current.bTime).toBe(10.0);
    });

    it('shows OSD message with B point time', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });

      expect(result.current.osdMessage).toBe('A-B Loop: B = 10.0s');
    });

    it('rejects B point if A point is not set', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setBPoint(10.0);
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.osdMessage).toBe('A-B Loop: Set A point first');
    });

    it('rejects B point if it is before or equal to A point', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(10.0);
      });
      act(() => {
        result.current.setBPoint(5.0);
      });

      expect(result.current.status).toBe('a_set');
      expect(result.current.bTime).toBeNull();
      expect(result.current.osdMessage).toBe('A-B Loop: B must be after A');
    });

    it('rejects B point equal to A point', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(10.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });

      expect(result.current.status).toBe('a_set');
      expect(result.current.bTime).toBeNull();
    });

    it('snaps to nearest subtitle end time when cues provided', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const cues: SubtitleCue[] = [
        createCue('1', 0, 3, 'First'),
        createCue('2', 3, 7, 'Second'),
        createCue('3', 7, 10, 'Third'),
      ];

      const { result } = renderHook(() =>
        useABLoop({ videoRef: ref, cues }),
      );

      act(() => {
        result.current.setAPoint(3.0);
      });
      act(() => {
        result.current.setBPoint(8.5);
      });

      expect(result.current.bTime).toBe(7.0);
    });
  });

  describe('startLoop', () => {
    it('transitions from ab_set to looping and seeks to A point', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });

      expect(result.current.status).toBe('looping');
      expect(video.currentTime).toBe(5.0);
      expect(result.current.osdMessage).toBe('A-B Loop: Looping');
    });

    it('does nothing when in idle state', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.startLoop();
      });

      expect(result.current.status).toBe('idle');
    });

    it('does nothing when in a_set state', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.startLoop();
      });

      expect(result.current.status).toBe('a_set');
    });

    it('does nothing when already looping', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });
      expect(result.current.status).toBe('looping');

      act(() => {
        result.current.startLoop();
      });
      expect(result.current.status).toBe('looping');
    });
  });

  describe('stopLoop', () => {
    it('transitions from looping to ab_set', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });
      act(() => {
        result.current.stopLoop();
      });

      expect(result.current.status).toBe('ab_set');
      expect(result.current.aTime).toBe(5.0);
      expect(result.current.bTime).toBe(10.0);
      expect(result.current.osdMessage).toBe('A-B Loop: Stopped');
    });

    it('does nothing when not looping', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.stopLoop();
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('clearLoop', () => {
    it('clears all state and returns to idle from any state', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.clearLoop();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.aTime).toBeNull();
      expect(result.current.bTime).toBeNull();
      expect(result.current.osdMessage).toBe('A-B Loop: Cleared');
    });

    it('clears from looping state', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });
      act(() => {
        result.current.clearLoop();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.aTime).toBeNull();
      expect(result.current.bTime).toBeNull();
    });

    it('clears from idle state (no-op)', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.clearLoop();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.osdMessage).toBe('A-B Loop: Cleared');
    });
  });

  describe('OSD messages', () => {
    it('auto-dismisses OSD message after 2 seconds', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      expect(result.current.osdMessage).toBe('A-B Loop: A = 5.0s');

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.osdMessage).toBeNull();
    });

    it('replaces previous OSD message when new action occurs', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      expect(result.current.osdMessage).toBe('A-B Loop: A = 5.0s');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        result.current.setBPoint(10.0);
      });
      expect(result.current.osdMessage).toBe('A-B Loop: B = 10.0s');

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.osdMessage).toBeNull();
    });
  });

  describe('loop detection', () => {
    it('jumps back to A when video passes B point', () => {
      const { video, listeners } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });

      video.currentTime = 9.6;

      act(() => {
        vi.advanceTimersByTime(250);
        const handlers = listeners['timeupdate'] ?? [];
        handlers.forEach((h) => h(new Event('timeupdate')));
      });

      expect(video.currentTime).toBe(5.0);
    });

    it('jumps to A when video is before A point', () => {
      const { video, listeners } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });

      video.currentTime = 4.5;

      act(() => {
        vi.advanceTimersByTime(250);
        const handlers = listeners['timeupdate'] ?? [];
        handlers.forEach((h) => h(new Event('timeupdate')));
      });

      expect(video.currentTime).toBe(5.0);
    });

    it('does not jump when video is within loop range', () => {
      const { video, listeners } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });

      video.currentTime = 7.0;

      act(() => {
        vi.advanceTimersByTime(250);
        const handlers = listeners['timeupdate'] ?? [];
        handlers.forEach((h) => h(new Event('timeupdate')));
      });

      expect(video.currentTime).toBe(7.0);
    });

    it('respects cooldown after loop jump', () => {
      const { video, listeners } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });

      video.currentTime = 9.6;

      act(() => {
        vi.advanceTimersByTime(250);
        const handlers = listeners['timeupdate'] ?? [];
        handlers.forEach((h) => h(new Event('timeupdate')));
      });

      expect(video.currentTime).toBe(5.0);

      video.currentTime = 9.8;

      act(() => {
        vi.advanceTimersByTime(100);
        const handlers = listeners['timeupdate'] ?? [];
        handlers.forEach((h) => h(new Event('timeupdate')));
      });

      expect(video.currentTime).toBe(9.8);
    });
  });

  describe('video ended event', () => {
    it('stops loop when video ends', () => {
      const { video, listeners } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      act(() => {
        result.current.setBPoint(10.0);
      });
      act(() => {
        result.current.startLoop();
      });
      expect(result.current.status).toBe('looping');

      act(() => {
        const handlers = listeners['ended'] ?? [];
        handlers.forEach((h) => h(new Event('ended')));
      });

      expect(result.current.status).toBe('ab_set');
      expect(result.current.aTime).toBe(5.0);
      expect(result.current.bTime).toBe(10.0);
    });

    it('does not change state when not looping and video ends', () => {
      const { video, listeners } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      act(() => {
        result.current.setAPoint(5.0);
      });
      expect(result.current.status).toBe('a_set');

      act(() => {
        const handlers = listeners['ended'] ?? [];
        handlers.forEach((h) => h(new Event('ended')));
      });

      expect(result.current.status).toBe('a_set');
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { unmount } = renderHook(() => useABLoop({ videoRef: ref }));

      unmount();

      expect(video.removeEventListener).toHaveBeenCalledWith(
        'timeupdate',
        expect.any(Function),
      );
      expect(video.removeEventListener).toHaveBeenCalledWith(
        'ended',
        expect.any(Function),
      );
    });

    it('cancels animation frame on unmount', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
      const { unmount } = renderHook(() => useABLoop({ videoRef: ref }));

      unmount();

      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });
  });

  describe('full workflow', () => {
    it('complete A-B loop workflow: set A → set B → start → stop → start → clear', () => {
      const { video } = createMockVideoElement();
      const ref = { current: video };
      const { result } = renderHook(() => useABLoop({ videoRef: ref }));

      expect(result.current.status).toBe('idle');

      act(() => {
        result.current.setAPoint(5.0);
      });
      expect(result.current.status).toBe('a_set');
      expect(result.current.aTime).toBe(5.0);

      act(() => {
        result.current.setBPoint(10.0);
      });
      expect(result.current.status).toBe('ab_set');
      expect(result.current.bTime).toBe(10.0);

      act(() => {
        result.current.startLoop();
      });
      expect(result.current.status).toBe('looping');

      act(() => {
        result.current.stopLoop();
      });
      expect(result.current.status).toBe('ab_set');

      act(() => {
        result.current.startLoop();
      });
      expect(result.current.status).toBe('looping');

      act(() => {
        result.current.clearLoop();
      });
      expect(result.current.status).toBe('idle');
      expect(result.current.aTime).toBeNull();
      expect(result.current.bTime).toBeNull();
    });
  });
});