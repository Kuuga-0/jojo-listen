/**
 * Tests for video.ts - convertFileSrc and playback rate functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertFileSrc, PLAYBACK_RATES, type PlaybackRate } from '../video';

// Mock the @tauri-apps/api/core module
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('convertFileSrc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call invoke with correct command and path', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    mockInvoke.mockResolvedValue('file:///C:/Videos/test.mp4');

    const result = await convertFileSrc('C:\\Videos\\test.mp4');

    expect(mockInvoke).toHaveBeenCalledWith('convert_file_src', {
      path: 'C:\\Videos\\test.mp4',
    });
    expect(result).toBe('file:///C:/Videos/test.mp4');
  });

  it('should return the URL returned by invoke', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    const expectedUrl = 'file:///Users/name/Videos/sample.mp4';
    mockInvoke.mockResolvedValue(expectedUrl);

    const result = await convertFileSrc('/Users/name/Videos/sample.mp4');

    expect(result).toBe(expectedUrl);
  });

  it('should handle Windows paths with backslashes', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    mockInvoke.mockResolvedValue('file:///D:/Movies/video.mp4');

    const result = await convertFileSrc('D:\\Movies\\video.mp4');

    expect(mockInvoke).toHaveBeenCalledWith('convert_file_src', {
      path: 'D:\\Movies\\video.mp4',
    });
    expect(typeof result).toBe('string');
    expect(result).toContain('file://');
  });

  it('should propagate errors from invoke', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockInvoke = invoke as ReturnType<typeof vi.fn>;
    mockInvoke.mockRejectedValue(new Error('Tauri error'));

    await expect(convertFileSrc('invalid/path')).rejects.toThrow('Tauri error');
  });
});

describe('PLAYBACK_RATES', () => {
  it('should contain all required playback rates', () => {
    const expectedRates: readonly (0.5 | 0.75 | 1.0 | 1.25 | 1.5)[] = [0.5, 0.75, 1.0, 1.25, 1.5];
    expect(PLAYBACK_RATES).toEqual(expectedRates);
  });

  it('should have 5 playback rate options', () => {
    expect(PLAYBACK_RATES).toHaveLength(5);
  });

  it('should be in ascending order', () => {
    for (let i = 1; i < PLAYBACK_RATES.length; i++) {
      expect(PLAYBACK_RATES[i]).toBeGreaterThan(PLAYBACK_RATES[i - 1]);
    }
  });

  it('should include 1.0x as default rate', () => {
    expect(PLAYBACK_RATES).toContain(1.0);
  });

  it('should have minimum rate of 0.5x', () => {
    expect(PLAYBACK_RATES[0]).toBe(0.5);
  });

  it('should have maximum rate of 1.5x', () => {
    expect(PLAYBACK_RATES[PLAYBACK_RATES.length - 1]).toBe(1.5);
  });
});

describe('PlaybackRate type', () => {
  it('should accept valid playback rate values', () => {
    const validRate: PlaybackRate = 1.0;
    expect(PLAYBACK_RATES).toContain(validRate);
  });

  it('should accept minimum rate', () => {
    const minRate: PlaybackRate = 0.5;
    expect(minRate).toBe(0.5);
  });

  it('should accept maximum rate', () => {
    const maxRate: PlaybackRate = 1.5;
    expect(maxRate).toBe(1.5);
  });
});
