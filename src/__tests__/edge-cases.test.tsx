import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { createElement as h } from 'react';
import {
  parseSRT,
  parseASS,
  parseSubtitle,
  detectSubtitleFormat,
  stripBOM,
  stripHtmlTags,
} from '../lib/subtitle/parser';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider, useToast } from '../components/Toast';
import { useABLoop } from '../hooks/useABLoop';

describe('Subtitle Parser Edge Cases', () => {
  describe('parseSubtitle', () => {
    it('returns empty array for null input', () => {
      expect(parseSubtitle(null as unknown as string, 'srt')).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(parseSubtitle(undefined as unknown as string, 'srt')).toEqual([]);
    });

    it('returns empty array for empty string input', () => {
      expect(parseSubtitle('', 'srt')).toEqual([]);
    });

    it('returns empty array for whitespace-only input', () => {
      expect(parseSubtitle('   \n\n  ', 'srt')).toEqual([]);
    });

    it('returns empty array for non-string input', () => {
      expect(parseSubtitle(42 as unknown as string, 'srt')).toEqual([]);
    });
  });

  describe('parseSRT edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseSRT('')).toEqual([]);
    });

    it('returns empty array for whitespace-only content', () => {
      expect(parseSRT('   \n\n   ')).toEqual([]);
    });

    it('handles corrupt/binary content gracefully', () => {
      const binaryContent = '\x00\x01\x02\x03\xff\xfe random binary garbage';
      const result = parseSRT(binaryContent);
      expect(Array.isArray(result)).toBe(true);
    });

    it('skips cues with malformed timestamps and keeps good ones', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
Good cue

2
INVALID_TIMESTAMP --> 00:00:05,000
Bad timestamp

3
00:00:06,000 --> 00:00:08,000
Another good cue`;
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(2);
      expect(cues[0].text).toBe('Good cue');
      expect(cues[1].text).toBe('Another good cue');
    });

    it('strips HTML tags from subtitle text', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
<i>Italic text</i>`;
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Italic text');
      expect(cues[0].originalText).toBe('<i>Italic text</i>');
    });

    it('strips bold HTML tags', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
<b>Bold text</b>`;
      const cues = parseSRT(srt);
      expect(cues[0].text).toBe('Bold text');
    });

    it('strips font tags with attributes', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
<font color="#ff0000">Red text</font>`;
      const cues = parseSRT(srt);
      expect(cues[0].text).toBe('Red text');
    });

    it('strips nested HTML tags', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
<i><b>Bold italic</b></i>`;
      const cues = parseSRT(srt);
      expect(cues[0].text).toBe('Bold italic');
    });

    it('handles BOM-prefixed SRT content', () => {
      const bom = '\uFEFF';
      const srt = `${bom}1\n00:00:01,000 --> 00:00:03,000\nHello`;
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Hello');
    });

    it('handles CRLF line endings', () => {
      const srt = '1\r\n00:00:01,000 --> 00:00:03,000\r\nHello';
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Hello');
    });

    it('handles CR-only line endings', () => {
      const srt = '1\r00:00:01,000 --> 00:00:03,000\rHello';
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Hello');
    });

    it('skips cues where start time >= end time', () => {
      const srt = `1
00:00:05,000 --> 00:00:03,000
Backward time`;
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(0);
    });

    it('skips cues with empty text after tag stripping', () => {
      const srt = `1
00:00:01,000 --> 00:00:03,000
<i></i>`;
      const cues = parseSRT(srt);
      expect(cues).toHaveLength(0);
    });

    it('parses a large SRT file within reasonable time', () => {
      const cues: string[] = [];
      for (let i = 1; i <= 10000; i++) {
        const totalSeconds = i;
        const startMs = totalSeconds * 1000;
        const endMs = startMs + 500;
        const startH = String(Math.floor(startMs / 3600000)).padStart(2, '0');
        const startM = String(Math.floor((startMs % 3600000) / 60000)).padStart(2, '0');
        const startS = String(Math.floor((startMs % 60000) / 1000)).padStart(2, '0');
        const startMsStr = String(startMs % 1000).padStart(3, '0');
        const endH = String(Math.floor(endMs / 3600000)).padStart(2, '0');
        const endM = String(Math.floor((endMs % 3600000) / 60000)).padStart(2, '0');
        const endS = String(Math.floor((endMs % 60000) / 1000)).padStart(2, '0');
        const endMsStr = String(endMs % 1000).padStart(3, '0');
        cues.push(`${i}\n${startH}:${startM}:${startS},${startMsStr} --> ${endH}:${endM}:${endS},${endMsStr}\nCue text ${i}`);
      }
      const srt = cues.join('\n\n');

      const start = performance.now();
      const result = parseSRT(srt);
      const elapsed = performance.now() - start;

      expect(result.length).toBeGreaterThan(9000);
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('parseASS edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(parseASS('')).toEqual([]);
    });

    it('handles missing Format line gracefully', () => {
      const ass = `[Script Info]
Title: Test
[Events]
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello`;
      const cues = parseASS(ass);
      expect(cues).toEqual([]);
    });

    it('handles BOM-prefixed ASS content', () => {
      const bom = '\uFEFF';
      const ass = `${bom}[Script Info]
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello`;
      const cues = parseASS(ass);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Hello');
    });

    it('strips HTML tags in ASS text', () => {
      const ass = `[Script Info]
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,<b>Bold</b> text`;
      const cues = parseASS(ass);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Bold text');
    });

    it('handles corrupt ASS content gracefully', () => {
      const corruptAss = 'random garbage \x00\x01 binary data';
      const result = parseASS(corruptAss);
      expect(Array.isArray(result)).toBe(true);
    });

    it('skips dialogue lines with invalid timestamps', () => {
      const ass = `[Script Info]
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,invalid,0:00:03.00,Default,,0,0,0,,Bad start
Dialogue: 0,0:00:01.00,invalid,Default,,0,0,0,,Bad end
Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,Good cue`;
      const cues = parseASS(ass);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Good cue');
    });

    it('strips ASS formatting overrides', () => {
      const ass = `[Script Info]
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\b1}Bold{\\b0} text`;
      const cues = parseASS(ass);
      expect(cues).toHaveLength(1);
      expect(cues[0].text).toBe('Bold text');
    });
  });

  describe('detectSubtitleFormat edge cases', () => {
    it('returns null for null input', () => {
      expect(detectSubtitleFormat(null as unknown as string)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectSubtitleFormat('')).toBeNull();
    });

    it('returns null for random text', () => {
      expect(detectSubtitleFormat('Just some random text without any format')).toBeNull();
    });
  });

  describe('stripHtmlTags edge cases', () => {
    it('handles self-closing br tags', () => {
      expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
    });

    it('handles br tag without slash', () => {
      expect(stripHtmlTags('Line 1<br>Line 2')).toBe('Line 1Line 2');
    });

    it('preserves text content when tags are stripped', () => {
      expect(stripHtmlTags('<font color="#fff">White</font> and <i>italic</i>')).toBe('White and italic');
    });
  });

  describe('stripBOM edge cases', () => {
    it('handles empty string', () => {
      expect(stripBOM('')).toBe('');
    });

    it('does not remove BOM in middle of string', () => {
      const text = 'hello\uFEFFworld';
      expect(stripBOM(text)).toBe('hello\uFEFFworld');
    });
  });
});

describe('A-B Loop Edge Cases', () => {
  // Verifying documented edge cases: A > B rejection and video ended behavior

  it('rejects A point set after B point (A > B scenario)', () => {
    const mockVideo = {
      currentTime: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const ref = { current: mockVideo } as unknown as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useABLoop({ videoRef: ref }));

    act(() => {
      result.current.setAPoint(5.0);
    });
    act(() => {
      result.current.setBPoint(10.0);
    });

    act(() => {
      result.current.setAPoint(15.0);
    });

    expect(result.current.aTime).toBe(5.0);
    expect(result.current.bTime).toBe(10.0);
    expect(result.current.osdMessage).toBe('A-B Loop: A must be before B');
  });

  it('rejects B point equal to A point', () => {
    const mockVideo = {
      currentTime: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const ref = { current: mockVideo } as unknown as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useABLoop({ videoRef: ref }));

    act(() => {
      result.current.setAPoint(5.0);
    });
    act(() => {
      result.current.setBPoint(5.0);
    });

    expect(result.current.bTime).toBeNull();
    expect(result.current.osdMessage).toBe('A-B Loop: B must be after A');
  });
});

describe('ErrorBoundary Edge Cases', () => {
  it('renders children when no error', () => {
    render(h(ErrorBoundary, null, h('div', null, 'Hello')));
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders error UI when child throws', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error message');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(ThrowingComponent)));
    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    expect(screen.getByText('Test error message')).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('has retry button', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(ThrowingComponent)));
    expect(screen.getByTestId('error-retry-button')).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('has reload button', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(ThrowingComponent)));
    expect(screen.getByTestId('error-reload-button')).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('has copy error details button', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(ThrowingComponent)));
    expect(screen.getByTestId('error-copy-button')).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('has stack trace toggle', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(ThrowingComponent)));
    expect(screen.getByTestId('error-stack-toggle')).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('shows stack trace when toggle is clicked', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(h(ErrorBoundary, null, h(ThrowingComponent)));

    const toggle = screen.getByTestId('error-stack-toggle');
    fireEvent.click(toggle);

    expect(screen.getByTestId('error-stack-trace')).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('uses custom fallback when provided', () => {
    const ThrowingComponent = () => {
      throw new Error('Custom error');
    };

    vi.spyOn(console, 'error').mockImplementation(() => {});

    const customFallback = (_error: Error, retry: () => void) =>
      h('div', { 'data-testid': 'custom-fallback' }, [
        h('span', null, 'Custom error UI'),
        h('button', { onClick: retry }, 'Retry'),
      ]);

    render(h(ErrorBoundary, { fallback: customFallback }, h(ThrowingComponent)));
    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.getByText('Custom error UI')).toBeTruthy();

    vi.restoreAllMocks();
  });
});

describe('Toast Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toast container only when toasts exist', () => {
    render(h(ToastProvider, null, h('div', null, 'App')));
    expect(screen.queryByTestId('toast-container')).toBeNull();
  });

  it('auto-dismisses error toast after 5 seconds', () => {
    function Trigger() {
      const { addToast } = useToast();
      return h('button', {
        'data-testid': 'trigger',
        onClick: () => addToast('error', 'Error occurred'),
      }, 'Trigger');
    }

    render(h(ToastProvider, null, h(Trigger)));
    fireEvent.click(screen.getByTestId('trigger'));

    expect(screen.getByText('Error occurred')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Error occurred')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Error occurred')).toBeNull();
  });

  it('auto-dismisses success toast after 3 seconds', () => {
    function Trigger() {
      const { addToast } = useToast();
      return h('button', {
        'data-testid': 'trigger',
        onClick: () => addToast('success', 'Success!'),
      }, 'Trigger');
    }

    render(h(ToastProvider, null, h(Trigger)));
    fireEvent.click(screen.getByTestId('trigger'));

    expect(screen.getByText('Success!')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Success!')).toBeNull();
  });

  it('allows custom duration', () => {
    function Trigger() {
      const { addToast } = useToast();
      return h('button', {
        'data-testid': 'trigger',
        onClick: () => addToast('info', 'Custom', 1000),
      }, 'Trigger');
    }

    render(h(ToastProvider, null, h(Trigger)));
    fireEvent.click(screen.getByTestId('trigger'));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Custom')).toBeNull();
  });

  it('dismisses toast manually via dismiss button', () => {
    function Trigger() {
      const { addToast } = useToast();
      return h('button', {
        'data-testid': 'trigger',
        onClick: () => addToast('warning', 'Warning!'),
      }, 'Trigger');
    }

    render(h(ToastProvider, null, h(Trigger)));
    fireEvent.click(screen.getByTestId('trigger'));

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Warning!')).toBeNull();
  });
});

describe('Global Error Handler', () => {
  it('unhandledrejection event can be dispatched and caught', () => {
    const handler = vi.fn();
    window.addEventListener('unhandledrejection', handler);

    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', { value: new Error('test error') });
    Object.defineProperty(event, 'promise', { value: Promise.resolve() });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();

    window.removeEventListener('unhandledrejection', handler);
  });
});