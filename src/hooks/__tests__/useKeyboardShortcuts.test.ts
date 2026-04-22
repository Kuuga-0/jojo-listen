import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import type { ShortcutCallbacks } from '../useKeyboardShortcuts';

function createMockCallbacks(): ShortcutCallbacks {
  return {
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
}

function fireKeyDown(key: string, options?: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { key, ...options });
  document.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  let callbacks: ShortcutCallbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = createMockCallbacks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('shortcut key mappings', () => {
    it('triggers onPlayPause on Space', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown(' ');
      expect(callbacks.onPlayPause).toHaveBeenCalledTimes(1);
    });

    it('triggers onSeekBackward on ArrowLeft', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('ArrowLeft');
      expect(callbacks.onSeekBackward).toHaveBeenCalledTimes(1);
    });

    it('triggers onSeekForward on ArrowRight', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('ArrowRight');
      expect(callbacks.onSeekForward).toHaveBeenCalledTimes(1);
    });

    it('triggers onPreviousSubtitle on ArrowUp', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('ArrowUp');
      expect(callbacks.onPreviousSubtitle).toHaveBeenCalledTimes(1);
    });

    it('triggers onNextSubtitle on ArrowDown', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('ArrowDown');
      expect(callbacks.onNextSubtitle).toHaveBeenCalledTimes(1);
    });

    it('triggers onSetAPoint on 1', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('1');
      expect(callbacks.onSetAPoint).toHaveBeenCalledTimes(1);
    });

    it('triggers onSetBPoint on 2', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('2');
      expect(callbacks.onSetBPoint).toHaveBeenCalledTimes(1);
    });

    it('triggers onToggleABLoop on 3', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('3');
      expect(callbacks.onToggleABLoop).toHaveBeenCalledTimes(1);
    });

    it('triggers onClearABLoop on 4', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('4');
      expect(callbacks.onClearABLoop).toHaveBeenCalledTimes(1);
    });

    it('triggers onDecreaseSpeed on [', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('[');
      expect(callbacks.onDecreaseSpeed).toHaveBeenCalledTimes(1);
    });

    it('triggers onIncreaseSpeed on ]', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown(']');
      expect(callbacks.onIncreaseSpeed).toHaveBeenCalledTimes(1);
    });

    it('triggers onEscape on Escape', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('Escape');
      expect(callbacks.onEscape).toHaveBeenCalledTimes(1);
    });

    it('triggers onToggleStealth on s', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('s');
      expect(callbacks.onToggleStealth).toHaveBeenCalledTimes(1);
    });

    it('triggers onToggleClickThrough on t', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown('t');
      expect(callbacks.onToggleClickThrough).toHaveBeenCalledTimes(1);
    });

    it('triggers onOpenSettings on ,', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));
      fireKeyDown(',');
      expect(callbacks.onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('input conflict handling', () => {
    it('does NOT trigger shortcuts when an input element is focused', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireKeyDown(' ');
      expect(callbacks.onPlayPause).not.toHaveBeenCalled();

      fireKeyDown('ArrowLeft');
      expect(callbacks.onSeekBackward).not.toHaveBeenCalled();

      fireKeyDown('s');
      expect(callbacks.onToggleStealth).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does NOT trigger shortcuts when a textarea element is focused', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      fireKeyDown(' ');
      expect(callbacks.onPlayPause).not.toHaveBeenCalled();

      fireKeyDown('t');
      expect(callbacks.onToggleClickThrough).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('does NOT trigger shortcuts when a contentEditable element is focused', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);

      // jsdom doesn't properly handle focus on contentEditable divs,
      // so we mock activeElement to simulate the focused state
      const spy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(div);

      fireKeyDown(' ');
      expect(callbacks.onPlayPause).not.toHaveBeenCalled();

      spy.mockRestore();
      document.body.removeChild(div);
    });

    it('DOES trigger Escape even when an input element is focused', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireKeyDown('Escape');
      expect(callbacks.onEscape).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });

    it('resumes shortcuts after input element loses focus', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const input = document.createElement('input');
      document.body.appendChild(input);

      // jsdom doesn't properly reset activeElement on blur,
      // so we mock activeElement to simulate focus/blur transitions
      const spy = vi.spyOn(document, 'activeElement', 'get');
      spy.mockReturnValue(input);

      fireKeyDown(' ');
      expect(callbacks.onPlayPause).not.toHaveBeenCalled();

      // Simulate blur by returning null (no focused element)
      spy.mockReturnValue(null);

      fireKeyDown(' ');
      expect(callbacks.onPlayPause).toHaveBeenCalledTimes(1);

      spy.mockRestore();
      document.body.removeChild(input);
    });
  });

  describe('OSD message display and auto-dismiss', () => {
    it('displays an OSD message when a shortcut is triggered', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown(' ');
      });

      expect(result.current.osdMessage).toBe('Play/Pause');
    });

    it('displays correct OSD message for speed decrease', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown('[');
      });

      expect(result.current.osdMessage).toBe('Speed: \u2193');
    });

    it('displays correct OSD message for speed increase', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown(']');
      });

      expect(result.current.osdMessage).toBe('Speed: \u2191');
    });

    it('displays correct OSD message for A-B loop set A', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown('1');
      });

      expect(result.current.osdMessage).toBe('A-B Loop: Set A point');
    });

    it('displays correct OSD message for A-B loop set B', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown('2');
      });

      expect(result.current.osdMessage).toBe('A-B Loop: Set B point');
    });

    it('displays correct OSD message for A-B loop toggle', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown('3');
      });

      expect(result.current.osdMessage).toBe('A-B Loop: Toggle');
    });

    it('displays correct OSD message for A-B loop clear', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown('4');
      });

      expect(result.current.osdMessage).toBe('A-B Loop: Cleared');
    });

    it('auto-dismisses OSD message after 2 seconds', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown(' ');
      });

      expect(result.current.osdMessage).toBe('Play/Pause');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.osdMessage).toBeNull();
    });

    it('replaces OSD message when a new shortcut is triggered before auto-dismiss', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown(' ');
      });
      expect(result.current.osdMessage).toBe('Play/Pause');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        fireKeyDown('[' );
      });
      expect(result.current.osdMessage).toBe('Speed: \u2193');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.osdMessage).toBeNull();
    });

    it('does NOT show OSD for Escape key', () => {
      const { result } = renderHook(() => useKeyboardShortcuts(callbacks));

      act(() => {
        fireKeyDown('Escape');
      });

      expect(result.current.osdMessage).toBeNull();
    });
  });

  describe('event listener cleanup', () => {
    it('removes event listener on unmount', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useKeyboardShortcuts(callbacks));

      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      const handler = addSpy.mock.calls[0][1];
      unmount();

      expect(removeSpy).toHaveBeenCalledWith('keydown', handler);
    });

    it('does not trigger callbacks after unmount', () => {
      const { unmount } = renderHook(() => useKeyboardShortcuts(callbacks));

      unmount();

      fireKeyDown(' ');
      expect(callbacks.onPlayPause).not.toHaveBeenCalled();
    });
  });

  describe('preventDefault behavior', () => {
    it('calls preventDefault on handled shortcut keys', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does NOT call preventDefault on unhandled keys', () => {
      renderHook(() => useKeyboardShortcuts(callbacks));

      const event = new KeyboardEvent('keydown', { key: 'x', cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('callback stability', () => {
    it('uses the latest callback reference when callbacks change', () => {
      const initialCallbacks = createMockCallbacks();
      const { rerender } = renderHook(
        (cb) => useKeyboardShortcuts(cb),
        { initialProps: initialCallbacks },
      );

      const newCallbacks = createMockCallbacks();
      rerender(newCallbacks);

      fireKeyDown(' ');
      expect(newCallbacks.onPlayPause).toHaveBeenCalledTimes(1);
      expect(initialCallbacks.onPlayPause).not.toHaveBeenCalled();
    });
  });
});