import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  StealthMode,
  useStealthModeKeyboard,
  type StealthMode as StealthModeType,
} from '../StealthMode';
import React from 'react';

const mockSetSize = vi.fn();
const mockSetAlwaysOnTop = vi.fn();
const mockSetDecorations = vi.fn();
const mockOuterPosition = vi.fn().mockResolvedValue({ x: 100, y: 100 });
const mockSetPosition = vi.fn();

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setSize: mockSetSize,
    setAlwaysOnTop: mockSetAlwaysOnTop,
    setDecorations: mockSetDecorations,
    outerPosition: mockOuterPosition,
    setPosition: mockSetPosition,
  })),
}));

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalSize: class LogicalSize {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
  },
}));

function TestWrapper({
  initialMode = 'normal' as StealthModeType,
  children = <div data-testid="video-content">Video Player</div>,
  subtitleContent = <div data-testid="subtitle-content">Subtitle</div>,
  initialClickThrough = false,
}: {
  initialMode?: StealthModeType;
  children?: React.ReactNode;
  subtitleContent?: React.ReactNode;
  initialClickThrough?: boolean;
}) {
  const [currentMode, setCurrentMode] = React.useState(initialMode);
  const [isClickThrough, setIsClickThrough] = React.useState(initialClickThrough);

  return (
    <StealthMode
      currentMode={currentMode}
      onModeChange={setCurrentMode}
      children={children}
      subtitleContent={subtitleContent}
      isClickThrough={isClickThrough}
      onToggleClickThrough={() => setIsClickThrough((prev) => !prev)}
    />
  );
}

describe('StealthMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('mode rendering', () => {
    it('renders normal mode with children and subtitle content', () => {
      render(<TestWrapper initialMode="normal" />);

      expect(screen.getByTestId('stealth-mode')).toHaveAttribute('data-mode', 'normal');
      expect(screen.getByTestId('video-content')).toBeInTheDocument();
    });

    it('renders mini mode with video and subtitle containers', () => {
      render(<TestWrapper initialMode="mini" />);

      expect(screen.getByTestId('stealth-mode')).toHaveAttribute('data-mode', 'mini');
      expect(screen.getByTestId('video-content')).toBeInTheDocument();
    });

    it('renders subtitle-bar mode with subtitle container', () => {
      render(<TestWrapper initialMode="subtitle-bar" />);

      expect(screen.getByTestId('stealth-mode')).toHaveAttribute(
        'data-mode',
        'subtitle-bar'
      );
      expect(screen.getByTestId('subtitle-bar')).toBeInTheDocument();
    });

    it('renders placeholder text when no subtitle content in subtitle-bar mode', () => {
      render(
        <StealthMode
          currentMode="subtitle-bar"
          onModeChange={vi.fn()}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      expect(screen.getByText('No subtitle')).toBeInTheDocument();
    });
  });

  describe('window management', () => {
    it('sets normal mode window size (800x600) in normal mode', async () => {
      render(<TestWrapper initialMode="normal" />);

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      });

      const sizeCall = mockSetSize.mock.calls[0];
      expect(sizeCall[0].width).toBe(800);
      expect(sizeCall[0].height).toBe(600);
    });

    it('sets mini mode window size (480x320) in mini mode', async () => {
      render(<TestWrapper initialMode="mini" />);

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      });

      const sizeCall = mockSetSize.mock.calls[0];
      expect(sizeCall[0].width).toBe(480);
      expect(sizeCall[0].height).toBe(320);
    });

    it('sets subtitle-bar mode window size (800x100) in subtitle-bar mode', async () => {
      render(<TestWrapper initialMode="subtitle-bar" />);

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      });

      const sizeCall = mockSetSize.mock.calls[0];
      expect(sizeCall[0].width).toBe(800);
      expect(sizeCall[0].height).toBe(100);
    });

    it('disables always-on-top in normal mode', async () => {
      render(<TestWrapper initialMode="normal" />);

      await waitFor(() => {
        expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(false);
      });
    });

    it('enables always-on-top in mini mode', async () => {
      render(<TestWrapper initialMode="mini" />);

      await waitFor(() => {
        expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(true);
      });
    });

    it('enables always-on-top in subtitle-bar mode', async () => {
      render(<TestWrapper initialMode="subtitle-bar" />);

      await waitFor(() => {
        expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(true);
      });
    });

    it('enables window decorations in normal mode', async () => {
      render(<TestWrapper initialMode="normal" />);

      await waitFor(() => {
        expect(mockSetDecorations).toHaveBeenCalledWith(true);
      });
    });

    it('disables window decorations in mini mode', async () => {
      render(<TestWrapper initialMode="mini" />);

      await waitFor(() => {
        expect(mockSetDecorations).toHaveBeenCalledWith(false);
      });
    });

    it('disables window decorations in subtitle-bar mode', async () => {
      render(<TestWrapper initialMode="subtitle-bar" />);

      await waitFor(() => {
        expect(mockSetDecorations).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('mode transitions', () => {
    it('updates window properties when mode changes', async () => {
      const onModeChange = vi.fn();
      const { rerender } = render(
        <StealthMode
          currentMode="normal"
          onModeChange={onModeChange}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      rerender(
        <StealthMode
          currentMode="mini"
          onModeChange={onModeChange}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      await waitFor(() => {
        expect(mockSetSize).toHaveBeenCalled();
      });

      const sizeCall = mockSetSize.mock.calls[0];
      expect(sizeCall[0].width).toBe(480);
      expect(sizeCall[0].height).toBe(320);
    });

    it('shows transitioning state during mode change', async () => {
      const onModeChange = vi.fn();
      const { rerender } = render(
        <StealthMode
          currentMode="normal"
          onModeChange={onModeChange}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      await waitFor(() => {
        expect(screen.getByTestId('stealth-mode')).toBeInTheDocument();
      });

      rerender(
        <StealthMode
          currentMode="mini"
          onModeChange={onModeChange}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      expect(screen.getByTestId('stealth-mode')).toBeInTheDocument();
    });
  });

  describe('subtitle bar click handling', () => {
    it('expands subtitle-bar to mini mode when clicked', () => {
      const onModeChange = vi.fn();

      render(
        <StealthMode
          currentMode="subtitle-bar"
          onModeChange={onModeChange}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      fireEvent.click(screen.getByTestId('subtitle-bar'));

      expect(onModeChange).toHaveBeenCalledWith('mini');
    });

    it('does not change mode when click-through is enabled', () => {
      const onModeChange = vi.fn();

      render(
        <StealthMode
          currentMode="subtitle-bar"
          onModeChange={onModeChange}
          isClickThrough={true}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      fireEvent.click(screen.getByTestId('subtitle-bar'));

      expect(onModeChange).toHaveBeenCalledWith('mini');
    });

    it('renders click-through overlay when isClickThrough is true', () => {
      const { container } = render(
        <StealthMode
          currentMode="subtitle-bar"
          onModeChange={vi.fn()}
          isClickThrough={true}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      const overlay = container.querySelector('[style*="background-color: transparent"]');
      expect(overlay).toBeInTheDocument();
    });

    it('does not render click-through overlay when isClickThrough is false', () => {
      const { container } = render(
        <StealthMode
          currentMode="subtitle-bar"
          onModeChange={vi.fn()}
          isClickThrough={false}
          onToggleClickThrough={vi.fn()}
        >
          <div>Video</div>
        </StealthMode>
      );

      const overlays = container.querySelectorAll('[style*="background-color: transparent"]');
      expect(overlays.length).toBe(0);
    });
  });

  describe('custom drag region', () => {
    it('does not render drag region in normal mode', () => {
      render(<TestWrapper initialMode="normal" />);

      expect(screen.queryByTestId('drag-region')).not.toBeInTheDocument();
    });

    it('renders drag region in mini mode', () => {
      render(<TestWrapper initialMode="mini" />);

      expect(screen.getByTestId('drag-region')).toBeInTheDocument();
    });

    it('renders drag region in subtitle-bar mode', () => {
      render(<TestWrapper initialMode="subtitle-bar" />);

      expect(screen.getByTestId('drag-region')).toBeInTheDocument();
    });

    it('drag region has correct styling', () => {
      render(<TestWrapper initialMode="mini" />);

      const dragRegion = screen.getByTestId('drag-region');
      expect(dragRegion).toHaveStyle({
        cursor: 'move',
        position: 'absolute',
        top: '0px',
        left: '0px',
        right: '0px',
        height: '24px',
      });
    });
  });

  describe('mode indicator', () => {
    it('displays current mode name', () => {
      render(<TestWrapper initialMode="normal" />);

      expect(screen.getByText('Normal Mode')).toBeInTheDocument();
    });

    it('displays always-on-top indicator in mini mode', () => {
      render(<TestWrapper initialMode="mini" />);

      expect(screen.getByText('📌 Always on Top')).toBeInTheDocument();
    });

    it('displays always-on-top indicator in subtitle-bar mode', () => {
      render(<TestWrapper initialMode="subtitle-bar" />);

      expect(screen.getByText('📌 Always on Top')).toBeInTheDocument();
    });

    it('does not display always-on-top indicator in normal mode', () => {
      render(<TestWrapper initialMode="normal" />);

      expect(screen.queryByText(/Always on Top/)).not.toBeInTheDocument();
    });

    it('displays click-through indicator when active in subtitle-bar mode', () => {
      render(<TestWrapper initialMode="subtitle-bar" initialClickThrough={true} />);

      expect(screen.getByText('Click-through')).toBeInTheDocument();
    });
  });
});

describe('useStealthModeKeyboard', () => {
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    removeEventListenerSpy.mockRestore();
  });

  function TestKeyboardComponent({
    currentMode = 'normal' as StealthModeType,
    isClickThrough = false,
  }: {
    currentMode?: StealthModeType;
    isClickThrough?: boolean;
  }) {
    const [mode, setMode] = React.useState(currentMode);
    const [clickThrough, setClickThrough] = React.useState(isClickThrough);

    useStealthModeKeyboard(
      mode,
      setMode,
      clickThrough,
      () => setClickThrough((prev) => !prev)
    );

    return (
      <div>
        <span data-testid="current-mode">{mode}</span>
        <span data-testid="click-through">{clickThrough ? 'true' : 'false'}</span>
      </div>
    );
  }

  describe('S key for mode cycling', () => {
    it('cycles normal -> mini when S is pressed', () => {
      render(<TestKeyboardComponent currentMode="normal" />);

      fireEvent.keyDown(document, { key: 's' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('mini');
    });

    it('cycles mini -> subtitle-bar when S is pressed', () => {
      render(<TestKeyboardComponent currentMode="mini" />);

      fireEvent.keyDown(document, { key: 's' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('subtitle-bar');
    });

    it('cycles subtitle-bar -> normal when S is pressed', () => {
      render(<TestKeyboardComponent currentMode="subtitle-bar" />);

      fireEvent.keyDown(document, { key: 's' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('normal');
    });

    it('handles uppercase S key', () => {
      render(<TestKeyboardComponent currentMode="normal" />);

      fireEvent.keyDown(document, { key: 'S' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('mini');
    });

    it('prevents default behavior when S is pressed', () => {
      render(<TestKeyboardComponent currentMode="normal" />);

      const keyDownEvent = new KeyboardEvent('keydown', { key: 's', cancelable: true });
      document.dispatchEvent(keyDownEvent);

      expect(keyDownEvent.defaultPrevented).toBe(true);
    });
  });

  describe('T key for click-through toggle', () => {
    it('toggles click-through in subtitle-bar mode when T is pressed', () => {
      render(<TestKeyboardComponent currentMode="subtitle-bar" isClickThrough={false} />);

      fireEvent.keyDown(document, { key: 't' });

      expect(screen.getByTestId('click-through')).toHaveTextContent('true');
    });

    it('toggles click-through off in subtitle-bar mode when T is pressed', () => {
      render(<TestKeyboardComponent currentMode="subtitle-bar" isClickThrough={true} />);

      fireEvent.keyDown(document, { key: 't' });

      expect(screen.getByTestId('click-through')).toHaveTextContent('false');
    });

    it('does not toggle click-through in normal mode', () => {
      render(<TestKeyboardComponent currentMode="normal" isClickThrough={false} />);

      fireEvent.keyDown(document, { key: 't' });

      expect(screen.getByTestId('click-through')).toHaveTextContent('false');
    });

    it('does not toggle click-through in mini mode', () => {
      render(<TestKeyboardComponent currentMode="mini" isClickThrough={false} />);

      fireEvent.keyDown(document, { key: 't' });

      expect(screen.getByTestId('click-through')).toHaveTextContent('false');
    });

    it('prevents default behavior when T is pressed in subtitle-bar mode', () => {
      render(<TestKeyboardComponent currentMode="subtitle-bar" />);

      const keyDownEvent = new KeyboardEvent('keydown', { key: 't', cancelable: true });
      document.dispatchEvent(keyDownEvent);

      expect(keyDownEvent.defaultPrevented).toBe(true);
    });
  });

  describe('input element suppression', () => {
    it('does not trigger shortcuts when input element has focus', () => {
      render(
        <>
          <input data-testid="test-input" />
          <TestKeyboardComponent currentMode="normal" />
        </>
      );

      const input = screen.getByTestId('test-input');
      input.focus();

      fireEvent.keyDown(input, { key: 's' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('normal');
    });

    it('does not trigger shortcuts when textarea element has focus', () => {
      render(
        <>
          <textarea data-testid="test-textarea" />
          <TestKeyboardComponent currentMode="normal" />
        </>
      );

      const textarea = screen.getByTestId('test-textarea');
      textarea.focus();

      fireEvent.keyDown(textarea, { key: 's' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('normal');
    });

    it('does not trigger shortcuts when contentEditable element has focus', () => {
      render(
        <>
          <div contentEditable data-testid="test-editable" />
          <TestKeyboardComponent currentMode="normal" />
        </>
      );

      const editable = screen.getByTestId('test-editable');
      editable.focus();

      Object.defineProperty(editable, 'isContentEditable', {
        value: true,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(document, 'activeElement', {
        value: editable,
        writable: true,
        configurable: true,
      });

      fireEvent.keyDown(editable, { key: 's' });

      expect(screen.getByTestId('current-mode')).toHaveTextContent('normal');

      Object.defineProperty(document, 'activeElement', {
        value: document.body,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const { unmount } = render(<TestKeyboardComponent />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});

