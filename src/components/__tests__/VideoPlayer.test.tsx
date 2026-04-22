import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoPlayer } from '../VideoPlayer';
import type { VideoPlayerHandle } from '../VideoPlayer';
import { createRef } from 'react';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../lib/player/video', () => ({
  convertFileSrc: vi.fn(),
  PLAYBACK_RATES: [0.5, 0.75, 1.0, 1.25, 1.5] as const,
}));

vi.mock('../../lib/subtitle', () => ({
  detectSubtitleFormat: vi.fn(),
  parseSubtitle: vi.fn(),
}));

import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '../../lib/player/video';
import { detectSubtitleFormat, parseSubtitle } from '../../lib/subtitle';

const mockOpen = open as ReturnType<typeof vi.fn>;
const mockConvertFileSrc = convertFileSrc as ReturnType<typeof vi.fn>;
const mockDetectSubtitleFormat = detectSubtitleFormat as ReturnType<typeof vi.fn>;
const mockParseSubtitle = parseSubtitle as ReturnType<typeof vi.fn>;

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertFileSrc.mockResolvedValue('asset://localhost/test-video.mp4');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders idle state by default', () => {
    render(<VideoPlayer />);
    expect(screen.getByRole('button', { name: /import video/i })).toBeTruthy();
    expect(screen.getByText('▶ Play')).toBeTruthy();
  });

  it('disables play button when no video is loaded', () => {
    render(<VideoPlayer />);
    const playButton = screen.getByText('▶ Play') as HTMLButtonElement;
    expect(playButton.disabled).toBe(true);
  });

  it('disables subtitle import when no video is loaded', () => {
    render(<VideoPlayer />);
    const subtitleButton = screen.getByRole('button', { name: /import subtitle/i }) as HTMLButtonElement;
    expect(subtitleButton.disabled).toBe(true);
  });

  it('imports video file via dialog', async () => {
    mockOpen.mockResolvedValue('/path/to/video.mp4');

    render(<VideoPlayer />);
    const importButton = screen.getByRole('button', { name: /import video/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({
        multiple: false,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'webm', 'mkv'],
          },
        ],
      });
    });

    await waitFor(() => {
      expect(mockConvertFileSrc).toHaveBeenCalledWith('/path/to/video.mp4');
    });
  });

  it('shows error when video import fails', async () => {
    mockOpen.mockRejectedValue(new Error('Dialog cancelled'));

    render(<VideoPlayer />);
    const importButton = screen.getByRole('button', { name: /import video/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to open video/i)).toBeTruthy();
    });
  });

  it('does nothing when dialog returns null', async () => {
    mockOpen.mockResolvedValue(null);

    render(<VideoPlayer />);
    const importButton = screen.getByRole('button', { name: /import video/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
    });

    expect(mockConvertFileSrc).not.toHaveBeenCalled();
  });

  it('imports subtitle file and parses it', async () => {
    mockOpen
      .mockResolvedValueOnce('/path/to/video.mp4')
      .mockResolvedValueOnce('/path/to/sub.srt');

    mockDetectSubtitleFormat.mockReturnValue('srt');
    mockParseSubtitle.mockReturnValue([
      {
        id: '1',
        startTime: 0,
        endTime: 5,
        text: 'Hello',
        originalText: 'Hello',
      },
    ]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('1\n00:00:00,000 --> 00:00:05,000\nHello'),
    }));

    const onCuesLoaded = vi.fn();
    render(<VideoPlayer onSubtitleCuesLoaded={onCuesLoaded} />);

    const importVideoButton = screen.getByRole('button', { name: /import video/i });
    fireEvent.click(importVideoButton);

    await waitFor(() => {
      expect(mockConvertFileSrc).toHaveBeenCalled();
    });

    const importSubButton = screen.getByRole('button', { name: /import subtitle/i });
    fireEvent.click(importSubButton);

    await waitFor(() => {
      expect(mockDetectSubtitleFormat).toHaveBeenCalled();
      expect(mockParseSubtitle).toHaveBeenCalled();
      expect(onCuesLoaded).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Hello' }),
        ]),
      );
    });

    expect(screen.getByText(/1 cues loaded/i)).toBeTruthy();
  });

  it('shows error for unsupported subtitle format', async () => {
    mockOpen
      .mockResolvedValueOnce('/path/to/video.mp4')
      .mockResolvedValueOnce('/path/to/sub.txt');

    mockDetectSubtitleFormat.mockReturnValue(null);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('random text'),
    }));

    render(<VideoPlayer />);

    const importVideoButton = screen.getByRole('button', { name: /import video/i });
    fireEvent.click(importVideoButton);

    await waitFor(() => {
      expect(mockConvertFileSrc).toHaveBeenCalled();
    });

    const importSubButton = screen.getByRole('button', { name: /import subtitle/i });
    fireEvent.click(importSubButton);

    await waitFor(() => {
      expect(screen.getByText(/unsupported subtitle format/i)).toBeTruthy();
    });
  });

  it('renders playback rate buttons', () => {
    render(<VideoPlayer />);
    expect(screen.getByText('0.5x')).toBeTruthy();
    expect(screen.getByText('0.75x')).toBeTruthy();
    expect(screen.getByText('1x')).toBeTruthy();
    expect(screen.getByText('1.25x')).toBeTruthy();
    expect(screen.getByText('1.5x')).toBeTruthy();
  });

  it('renders volume slider', () => {
    render(<VideoPlayer />);
    const volumeSlider = screen.getByRole('slider');
    expect(volumeSlider).toBeTruthy();
  });

  it('exposes imperative handle methods', () => {
    const ref = createRef<VideoPlayerHandle>();
    render(<VideoPlayer ref={ref} />);

    expect(ref.current).not.toBeNull();
    expect(typeof ref.current!.play).toBe('function');
    expect(typeof ref.current!.pause).toBe('function');
    expect(typeof ref.current!.seek).toBe('function');
    expect(typeof ref.current!.setPlaybackRate).toBe('function');
    expect(typeof ref.current!.getCurrentTime).toBe('function');
    expect(typeof ref.current!.setVolume).toBe('function');
  });

  it('imperative handle getCurrentTime returns 0 when no video', () => {
    const ref = createRef<VideoPlayerHandle>();
    render(<VideoPlayer ref={ref} />);

    expect(ref.current!.getCurrentTime()).toBe(0);
  });

  it('imperative handle setVolume clamps to 0-1 range', () => {
    const ref = createRef<VideoPlayerHandle>();
    render(<VideoPlayer ref={ref} />);

    expect(() => ref.current!.setVolume(0.5)).not.toThrow();
    expect(() => ref.current!.setVolume(-1)).not.toThrow();
    expect(() => ref.current!.setVolume(2)).not.toThrow();
  });

  it('displays time as 0:00 when no video loaded', () => {
    render(<VideoPlayer />);
    const timeElements = screen.getAllByText('0:00');
    expect(timeElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders progress bar', () => {
    const { container } = render(<VideoPlayer />);
    const progressBar = container.querySelector('[style*="cursor: pointer"]');
    expect(progressBar).toBeTruthy();
  });

  it('calls onSubtitleCuesLoaded callback', async () => {
    const onCuesLoaded = vi.fn();
    mockOpen
      .mockResolvedValueOnce('/path/to/video.mp4')
      .mockResolvedValueOnce('/path/to/sub.srt');

    mockDetectSubtitleFormat.mockReturnValue('srt');
    mockParseSubtitle.mockReturnValue([
      { id: '1', startTime: 0, endTime: 5, text: 'Test', originalText: 'Test' },
    ]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('subtitle content'),
    }));

    render(<VideoPlayer onSubtitleCuesLoaded={onCuesLoaded} />);

    fireEvent.click(screen.getByRole('button', { name: /import video/i }));

    await waitFor(() => {
      expect(mockConvertFileSrc).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /import subtitle/i }));

    await waitFor(() => {
      expect(onCuesLoaded).toHaveBeenCalledTimes(1);
      expect(onCuesLoaded).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Test' }),
        ]),
      );
    });
  });
});