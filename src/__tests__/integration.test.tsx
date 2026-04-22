import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { createElement as h } from 'react';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setSize: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setDecorations: vi.fn(),
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    setPosition: vi.fn(),
  })),
}));

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalSize: class LogicalSize {
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
    }
  },
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock('tauri-plugin-keychain', () => ({
  getItem: vi.fn().mockResolvedValue(null),
  saveItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/player/video', () => ({
  convertFileSrc: vi.fn().mockResolvedValue('asset://localhost/test-video.mp4'),
  PLAYBACK_RATES: [0.5, 0.75, 1.0, 1.25, 1.5] as const,
}));

vi.mock('../lib/subtitle', () => ({
  detectSubtitleFormat: vi.fn(),
  parseSubtitle: vi.fn(),
}));

vi.mock('../lib/llm/api', () => ({
  analyzeSentence: vi.fn().mockResolvedValue({
    translation: 'test translation',
    usage_context: [],
    grammar_notes: [],
    vocabulary: [],
  }),
}));

import App from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ThemeProvider } from '../theme';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { ShortcutCallbacks } from '../hooks/useKeyboardShortcuts';

describe('Integration: App with ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders App wrapped in ThemeProvider without crashing', () => {
    render(h(App));
    expect(screen.getByTestId('app-root')).toBeTruthy();
  });

  it('shows home page by default', () => {
    render(h(App));
    expect(screen.getByTestId('home-page')).toBeTruthy();
  });

  it('displays the app title', () => {
    render(h(App));
    expect(screen.getByText('JoJo Listen')).toBeTruthy();
  });

  it('shows import video button on home page', () => {
    render(h(App));
    expect(screen.getByTestId('import-video-button')).toBeTruthy();
  });

  it('shows import subtitle button on home page', () => {
    render(h(App));
    expect(screen.getByTestId('import-subtitle-button')).toBeTruthy();
  });

  it('shows video list section', () => {
    render(h(App));
    expect(screen.getByTestId('video-list')).toBeTruthy();
  });
});

describe('Integration: Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts on home page and shows empty library message', () => {
    render(h(App));
    expect(screen.getByTestId('home-page')).toBeTruthy();
    expect(screen.getByText(/no videos yet/i)).toBeTruthy();
  });
});

describe('Integration: Keyboard shortcuts registration', () => {
  it('useKeyboardShortcuts registers all shortcut callbacks', () => {
    const callbacks: ShortcutCallbacks = {
      onPlayPause: vi.fn(),
      onSeekBackward: vi.fn(),
      onSeekForward: vi.fn(),
      onPreviousSubtitle: vi.fn(),
      onNextSubtitle: vi.fn(),
      onSetAPoint: vi.fn(),
      onSetBPoint: vi.fn(),
      onToggleABLoop: vi.fn(),
      onClearABLoop: vi.fn(),
      onDecreaseSpeed: vi.fn(),
      onIncreaseSpeed: vi.fn(),
      onEscape: vi.fn(),
      onToggleStealth: vi.fn(),
      onToggleClickThrough: vi.fn(),
      onOpenSettings: vi.fn(),
    };

    const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

    expect(result.current.osdMessage).toBeNull();

    fireEvent.keyDown(document, { key: ' ' });
    expect(callbacks.onPlayPause).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(callbacks.onEscape).toHaveBeenCalledTimes(1);
  });
});

describe('Integration: ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      h(ErrorBoundary, null, h('div', { 'data-testid': 'child' }, 'Hello')),
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('catches rendering errors and shows fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error message');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      h(ErrorBoundary, null, h(ThrowError)),
    );

    expect(screen.getByTestId('error-boundary')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test error message')).toBeTruthy();
    expect(screen.getByTestId('error-retry-button')).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('resets error state when retry button is clicked', () => {
    let shouldThrow = true;

    const MaybeThrowError = () => {
      if (shouldThrow) {
        throw new Error('Recoverable error');
      }
      return h('div', { 'data-testid': 'recovered' }, 'Recovered');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      h(ErrorBoundary, null, h(MaybeThrowError)),
    );

    expect(screen.getByTestId('error-boundary')).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByTestId('error-retry-button'));

    expect(screen.getByTestId('recovered')).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('accepts custom fallback prop', () => {
    const ThrowError = () => {
      throw new Error('Custom error');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const customFallback = (error: Error, _retry: () => void) =>
      h('div', { 'data-testid': 'custom-fallback' }, `Custom: ${error.message}`);

    render(
      h(ErrorBoundary, { fallback: customFallback }, h(ThrowError)),
    );

    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.getByText(/Custom: Custom error/)).toBeTruthy();

    consoleSpy.mockRestore();
  });
});

describe('Integration: LoadingSpinner', () => {
  it('renders spinner without message', () => {
    render(h(LoadingSpinner));
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  });

  it('renders spinner with message', () => {
    render(h(LoadingSpinner, { message: 'Loading video...' }));
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    expect(screen.getByText('Loading video...')).toBeTruthy();
  });

  it('renders spinner with custom size', () => {
    render(h(LoadingSpinner, { size: 60 }));
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  });
});

describe('Integration: ThemeProvider', () => {
  it('provides theme context and sets data-theme attribute', () => {
    render(
      h(ThemeProvider, null, h('div', { 'data-testid': 'themed-child' }, 'Content')),
    );

    expect(screen.getByTestId('themed-child')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-frosted');
  });
});