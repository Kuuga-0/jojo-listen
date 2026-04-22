import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoSync } from '../useVideoSync';
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

describe('useVideoSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns default values when no video ref', () => {
    const ref = { current: null };
    const { result } = renderHook(() =>
      useVideoSync({ cues: [], videoRef: ref }),
    );

    expect(result.current.currentTime).toBe(0);
    expect(result.current.activeCue).toBeNull();
    expect(result.current.activeCueIndex).toBe(-1);
  });

  it('returns default values with empty cues', () => {
    const { video } = createMockVideoElement();
    const ref = { current: video };
    const { result } = renderHook(() =>
      useVideoSync({ cues: [], videoRef: ref }),
    );

    expect(result.current.currentTime).toBe(0);
    expect(result.current.activeCue).toBeNull();
    expect(result.current.activeCueIndex).toBe(-1);
  });

  it('detects active cue based on video currentTime', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 5.5;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 0, 3, 'First cue'),
      createCue('2', 3, 7, 'Second cue'),
      createCue('3', 7, 10, 'Third cue'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.currentTime).toBe(5.5);
    expect(result.current.activeCueIndex).toBe(1);
    expect(result.current.activeCue?.text).toBe('Second cue');
  });

  it('returns null activeCue when currentTime is between cues', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 7.5;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 0, 3, 'First cue'),
      createCue('2', 3, 7, 'Second cue'),
      createCue('3', 8, 10, 'Third cue'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.currentTime).toBe(7.5);
    expect(result.current.activeCueIndex).toBe(-1);
    expect(result.current.activeCue).toBeNull();
  });

  it('returns null activeCue when currentTime is before all cues', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 0.5;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 2, 5, 'First cue'),
      createCue('2', 5, 8, 'Second cue'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.activeCueIndex).toBe(-1);
    expect(result.current.activeCue).toBeNull();
  });

  it('returns null activeCue when currentTime is after all cues', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 15;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 2, 5, 'First cue'),
      createCue('2', 5, 10, 'Second cue'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.activeCueIndex).toBe(-1);
    expect(result.current.activeCue).toBeNull();
  });

  it('detects cue at exact startTime boundary', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 3;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 0, 3, 'First cue'),
      createCue('2', 3, 7, 'Second cue'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    // At time=3, both cues match (3 >= 0 && 3 <= 3) and (3 >= 3 && 3 <= 7)
    // The first matching cue wins
    expect(result.current.activeCueIndex).toBe(0);
    expect(result.current.activeCue?.text).toBe('First cue');
  });

  it('detects cue at exact endTime boundary', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 7;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 3, 7, 'First cue'),
      createCue('2', 7, 10, 'Second cue'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.activeCueIndex).toBe(0);
    expect(result.current.activeCue?.text).toBe('First cue');
  });

  it('updates active cue when cues change', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 5;
    const ref = { current: video };

    const initialCues: SubtitleCue[] = [
      createCue('1', 0, 10, 'Initial cue'),
    ];

    const { result, rerender } = renderHook(
      ({ cues }) => useVideoSync({ cues, videoRef: ref }),
      { initialProps: { cues: initialCues } },
    );

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.activeCue?.text).toBe('Initial cue');

    const updatedCues: SubtitleCue[] = [
      createCue('1', 0, 3, 'New first'),
      createCue('2', 3, 7, 'New second'),
      createCue('3', 7, 10, 'New third'),
    ];

    rerender({ cues: updatedCues });

    act(() => {
      const handlers = listeners['timeupdate'] ?? [];
      handlers.forEach((h) => h(new Event('timeupdate')));
    });

    expect(result.current.activeCue?.text).toBe('New second');
    expect(result.current.activeCueIndex).toBe(1);
  });

  it('handles seeked event for immediate feedback', () => {
    const { video, listeners } = createMockVideoElement();
    video.currentTime = 8;
    const ref = { current: video };

    const cues: SubtitleCue[] = [
      createCue('1', 0, 5, 'First'),
      createCue('2', 5, 10, 'Second'),
    ];

    const { result } = renderHook(() =>
      useVideoSync({ cues, videoRef: ref }),
    );

    act(() => {
      const handlers = listeners['seeked'] ?? [];
      handlers.forEach((h) => h(new Event('seeked')));
    });

    expect(result.current.currentTime).toBe(8);
    expect(result.current.activeCue?.text).toBe('Second');
  });

  it('cleans up event listeners on unmount', () => {
    const { video } = createMockVideoElement();
    const ref = { current: video };

    const { unmount } = renderHook(() =>
      useVideoSync({ cues: [], videoRef: ref }),
    );

    unmount();

    expect(video.removeEventListener).toHaveBeenCalledWith(
      'timeupdate',
      expect.any(Function),
    );
    expect(video.removeEventListener).toHaveBeenCalledWith(
      'seeked',
      expect.any(Function),
    );
  });

  it('uses custom syncInterval', () => {
    const { video } = createMockVideoElement();
    const ref = { current: video };

    const { result } = renderHook(() =>
      useVideoSync({ cues: [], videoRef: ref, syncInterval: 200 }),
    );

    expect(result.current.currentTime).toBe(0);
  });
});