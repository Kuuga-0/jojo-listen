import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Callbacks for keyboard shortcut actions.
 * Each callback is a no-arg function that the consumer provides.
 */
export interface ShortcutCallbacks {
  onPlayPause: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onPreviousSubtitle: () => void;
  onNextSubtitle: () => void;
  onSetAPoint: () => void;
  onSetBPoint: () => void;
  onToggleABLoop: () => void;
  onClearABLoop: () => void;
  onDecreaseSpeed: () => void;
  onIncreaseSpeed: () => void;
  onEscape: () => void;
  onToggleStealth: () => void;
  onToggleClickThrough: () => void;
  onOpenSettings: () => void;
}

/** Duration in ms that an OSD message stays visible before auto-dismissing. */
const OSD_DISPLAY_DURATION = 2000;

/**
 * Check whether an input-like element currently has focus.
 * When true, most shortcuts should be suppressed (except Escape).
 */
function isInputElementFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tagName = active.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;
  const el = active as HTMLElement;
  if (el.isContentEditable || el.contentEditable === 'true') return true;
  return false;
}

/**
 * Global keyboard shortcuts hook for the JoJo Listen desktop app.
 *
 * Registers DOM `keydown` listeners and dispatches to the provided callbacks.
 * Shortcuts are suppressed when an input/textarea/contentEditable element is
 * focused, except for Escape which always fires.
 *
 * Returns an `osdMessage` string (or null) that can be rendered as an
 * on-screen display overlay. Messages auto-dismiss after 2 seconds.
 */
export function useKeyboardShortcuts(callbacks: ShortcutCallbacks): {
  osdMessage: string | null;
} {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const [osdMessage, setOsdMessage] = useState<string | null>(null);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOsd = useCallback((message: string) => {
    setOsdMessage(message);
    if (osdTimerRef.current !== null) {
      clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = setTimeout(() => {
      setOsdMessage(null);
      osdTimerRef.current = null;
    }, OSD_DISPLAY_DURATION);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key;
      const cb = callbacksRef.current;

      // Escape always works, even when an input element is focused
      if (key === 'Escape') {
        event.preventDefault();
        cb.onEscape();
        return;
      }

      // Suppress all other shortcuts when typing in an input field
      if (isInputElementFocused()) return;

      switch (key) {
        case ' ':
          event.preventDefault();
          cb.onPlayPause();
          showOsd('Play/Pause');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          cb.onSeekBackward();
          showOsd('\u23EA -5s');
          break;
        case 'ArrowRight':
          event.preventDefault();
          cb.onSeekForward();
          showOsd('\u23E9 +5s');
          break;
        case 'ArrowUp':
          event.preventDefault();
          cb.onPreviousSubtitle();
          showOsd('\u2B06 Previous subtitle');
          break;
        case 'ArrowDown':
          event.preventDefault();
          cb.onNextSubtitle();
          showOsd('\u2B07 Next subtitle');
          break;
        case '1':
          event.preventDefault();
          cb.onSetAPoint();
          showOsd('A-B Loop: Set A point');
          break;
        case '2':
          event.preventDefault();
          cb.onSetBPoint();
          showOsd('A-B Loop: Set B point');
          break;
        case '3':
          event.preventDefault();
          cb.onToggleABLoop();
          showOsd('A-B Loop: Toggle');
          break;
        case '4':
          event.preventDefault();
          cb.onClearABLoop();
          showOsd('A-B Loop: Cleared');
          break;
        case '[':
          event.preventDefault();
          cb.onDecreaseSpeed();
          showOsd('Speed: \u2193');
          break;
        case ']':
          event.preventDefault();
          cb.onIncreaseSpeed();
          showOsd('Speed: \u2191');
          break;
        case 's':
          event.preventDefault();
          cb.onToggleStealth();
          showOsd('Stealth mode toggled');
          break;
        case 't':
          event.preventDefault();
          cb.onToggleClickThrough();
          showOsd('Click-through toggled');
          break;
        case ',':
          event.preventDefault();
          cb.onOpenSettings();
          showOsd('Settings');
          break;
      }
    },
    [showOsd],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { osdMessage };
}