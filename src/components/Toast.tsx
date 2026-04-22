import { useState, useCallback, useRef, useEffect, createContext, useContext, type ReactNode } from 'react';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  error: 5000,
  warning: 3000,
  success: 3000,
  info: 3000,
};

let toastCounter = 0;

export interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = `toast-${++toastCounter}`;
      const actualDuration = duration ?? DEFAULT_DURATIONS[type];
      const toast: Toast = { id, type, message, duration: actualDuration };

      setToasts((prev) => {
        const next = [...prev, toast];
        return next.length > maxToasts ? next.slice(next.length - maxToasts) : next;
      });

      const timer = setTimeout(() => {
        removeToast(id);
      }, actualDuration);
      timersRef.current.set(id, timer);
    },
    [maxToasts, removeToast],
  );

  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div style={styles.container} data-testid="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const typeStyles = TYPE_STYLES[toast.type];

  return (
    <div
      style={{ ...styles.toast, ...typeStyles }}
      data-testid={`toast-${toast.id}`}
      role="alert"
    >
      <span style={styles.icon}>{ICONS[toast.type]}</span>
      <span style={styles.message}>{toast.message}</span>
      <button
        style={styles.dismissButton}
        onClick={() => onDismiss(toast.id)}
        data-testid={`toast-dismiss-${toast.id}`}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

const ICONS: Record<ToastType, string> = {
  error: '❌',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
};

const TYPE_STYLES: Record<ToastType, React.CSSProperties> = {
  error: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'var(--error)',
    color: 'var(--error)',
  },
  warning: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'var(--warning)',
    color: 'var(--warning)',
  },
  success: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: 'var(--success)',
    color: 'var(--success)',
  },
  info: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '400px',
    pointerEvents: 'auto',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    fontSize: 'var(--font-size-md)',
    lineHeight: '1.4',
    boxShadow: 'var(--shadow-card)',
    pointerEvents: 'auto',
  },
  icon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: '13px',
    wordBreak: 'break-word',
  },
  dismissButton: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
    transition: 'opacity 200ms ease',
  },
};

export { ToastContainer, ToastItem };