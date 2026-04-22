import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi';

export type StealthMode = 'normal' | 'mini' | 'subtitle-bar';

export interface StealthModeProps {
  currentMode: StealthMode;
  onModeChange: (mode: StealthMode) => void;
  children: React.ReactNode;
  subtitleContent?: React.ReactNode;
  isClickThrough: boolean;
  onToggleClickThrough: () => void;
}

const WINDOW_SIZES: Record<StealthMode, { width: number; height: number }> = {
  normal: { width: 800, height: 600 },
  mini: { width: 480, height: 320 },
  'subtitle-bar': { width: 800, height: 100 },
};

const MODE_CYCLE: StealthMode[] = ['normal', 'mini', 'subtitle-bar'];

function getNextMode(currentMode: StealthMode): StealthMode {
  const currentIndex = MODE_CYCLE.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
  return MODE_CYCLE[nextIndex];
}
export function StealthMode({
  currentMode,
  onModeChange,
  children,
  subtitleContent,
  isClickThrough,
}: StealthModeProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const windowRef = useRef(getCurrentWindow());

  useEffect(() => {
    const window = windowRef.current;
    const size = WINDOW_SIZES[currentMode];

    const updateWindow = async () => {
      setIsTransitioning(true);

      try {
        await window.setSize(new LogicalSize(size.width, size.height));
        await window.setAlwaysOnTop(currentMode !== 'normal');
        await window.setDecorations(currentMode === 'normal');
      } catch (error) {
        console.error('Failed to update window:', error);
      } finally {
        setTimeout(() => setIsTransitioning(false), 300);
      }
    };

    updateWindow();
  }, [currentMode]);

  const handleSubtitleBarClick = useCallback(() => {
    if (currentMode === 'subtitle-bar') {
      onModeChange('mini');
    }
  }, [currentMode, onModeChange]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (currentMode === 'normal') return;

      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
      };

      const handleMouseMove = async (moveEvent: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = moveEvent.clientX - dragStartRef.current.x;
        const deltaY = moveEvent.clientY - dragStartRef.current.y;

        try {
          const window = windowRef.current;
          const position = await window.outerPosition();
          await window.setPosition(new LogicalPosition(position.x + deltaX, position.y + deltaY));
          dragStartRef.current = {
            x: moveEvent.clientX,
            y: moveEvent.clientY,
          };
        } catch (error) {
          console.error('Failed to move window:', error);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [currentMode, isDragging]
  );

  const renderContent = () => {
    switch (currentMode) {
      case 'normal':
        return (
          <div style={styles.normalContainer}>
            {children}
            {subtitleContent && (
              <div style={styles.subtitleOverlay}>{subtitleContent}</div>
            )}
          </div>
        );

      case 'mini':
        return (
          <div style={styles.miniContainer}>
            <div style={styles.miniVideo}>{children}</div>
            {subtitleContent && (
              <div style={styles.miniSubtitle}>{subtitleContent}</div>
            )}
            <div style={styles.miniControls}>
              <span style={styles.miniLabel}>Mini Mode</span>
            </div>
          </div>
        );

      case 'subtitle-bar':
        return (
          <div
            style={{
              ...styles.subtitleBarContainer,
              ...(isClickThrough ? styles.clickThrough : {}),
            }}
            onClick={handleSubtitleBarClick}
            data-testid="subtitle-bar"
          >
            {isClickThrough && <div style={styles.clickThroughOverlay} />}
            <div style={styles.subtitleBarContent}>
              {subtitleContent || (
                <span style={styles.placeholderText}>No subtitle</span>
              )}
            </div>
            <div style={styles.subtitleBarControls}>
              <span style={styles.subtitleBarLabel}>Subtitle Bar</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        ...styles.container,
        ...(isTransitioning ? styles.transitioning : {}),
      }}
      data-mode={currentMode}
      data-testid="stealth-mode"
    >
      {currentMode !== 'normal' && (
        <div
          style={styles.dragRegion}
          onMouseDown={handleDragStart}
          data-testid="drag-region"
        />
      )}

      {renderContent()}
      <div style={styles.modeIndicator}>
        <span style={styles.modeText}>
          {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode
        </span>
        {currentMode !== 'normal' && (
          <span style={styles.alwaysOnTopIndicator}>📌 Always on Top</span>
        )}
        {currentMode === 'subtitle-bar' && isClickThrough && (
          <span style={styles.clickThroughIndicator}>Click-through</span>
        )}
      </div>
    </div>
  );
}

export function useStealthModeKeyboard(
  currentMode: StealthMode,
  onModeChange: (mode: StealthMode) => void,
  isClickThrough: boolean,
  onToggleClickThrough: () => void
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          const nextMode = getNextMode(currentMode);
          onModeChange(nextMode);
          break;
        case 't':
          if (currentMode === 'subtitle-bar') {
            event.preventDefault();
            onToggleClickThrough();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentMode, onModeChange, isClickThrough, onToggleClickThrough]);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    transition: 'all 300ms ease-in-out',
  },
  transitioning: {
    opacity: 0.8,
  },
  normalContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  subtitleOverlay: {
    position: 'absolute',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    zIndex: 10,
  },
  miniContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    boxSizing: 'border-box',
  },
  miniVideo: {
    flex: 1,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  miniSubtitle: {
    minHeight: '40px',
    backgroundColor: 'var(--overlay)',
    borderRadius: '4px',
    padding: '4px 8px',
    marginBottom: '4px',
  },
  miniControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  subtitleBarContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-primary)',
    backdropFilter: 'var(--blur-md)',
    WebkitBackdropFilter: 'var(--blur-md)',
    cursor: 'pointer',
    position: 'relative',
  },
  clickThrough: {
    cursor: 'default',
  },
  clickThroughOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  subtitleBarContent: {
    flex: 1,
    textAlign: 'center',
    padding: '0 16px',
    zIndex: 2,
  },
  subtitleBarControls: {
    position: 'absolute',
    top: '4px',
    right: '8px',
    zIndex: 3,
  },
  subtitleBarLabel: {
    fontSize: '8px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  placeholderText: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  dragRegion: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '24px',
    cursor: 'move',
    zIndex: 100,
    backgroundColor: 'var(--input-bg)',
  },
  modeIndicator: {
    position: 'absolute',
    bottom: '4px',
    left: '8px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    zIndex: 50,
  },
  modeText: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  alwaysOnTopIndicator: {
    fontSize: '10px',
    color: 'var(--accent)',
  },
  clickThroughIndicator: {
    fontSize: '10px',
    color: 'var(--error)',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: '2px 4px',
    borderRadius: '2px',
  },
};

export default StealthMode;