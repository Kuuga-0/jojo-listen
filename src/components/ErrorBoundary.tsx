import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showStack: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showStack: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, showStack: false });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleToggleStack = (): void => {
    this.setState((prev) => ({ showStack: !prev.showStack }));
  };

  handleCopyError = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const details = [
      `Error: ${error.message}`,
      `Stack: ${error.stack ?? 'No stack trace available'}`,
      errorInfo?.componentStack
        ? `Component Stack: ${errorInfo.componentStack}`
        : '',
      `Timestamp: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(details);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement('textarea');
      textarea.value = details;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      const { error, errorInfo, showStack } = this.state;

      return (
        <div style={styles.container} data-testid="error-boundary">
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>{error.message}</p>

          <div style={styles.buttonRow}>
            <button style={styles.retryButton} onClick={this.handleRetry} data-testid="error-retry-button">
              Try Again
            </button>
            <button style={styles.reloadButton} onClick={this.handleReload} data-testid="error-reload-button">
              Reload App
            </button>
          </div>

          <button style={styles.copyButton} onClick={this.handleCopyError} data-testid="error-copy-button">
            📋 Copy Error Details
          </button>

          {errorInfo?.componentStack && (
            <div style={styles.stackSection}>
              <button
                style={styles.stackToggle}
                onClick={this.handleToggleStack}
                data-testid="error-stack-toggle"
              >
                {showStack ? '▼ Hide Stack Trace' : '▶ Show Stack Trace'}
              </button>
              {showStack && (
                <pre style={styles.stackTrace} data-testid="error-stack-trace">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    maxWidth: '520px',
    margin: '0 auto',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '20px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },
  message: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0 0 24px 0',
    maxWidth: '400px',
    wordBreak: 'break-word',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  retryButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--accent)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
  reloadButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
  copyButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    marginBottom: '16px',
    transition: 'background-color 200ms ease',
  },
  stackSection: {
    width: '100%',
    textAlign: 'left',
  },
  stackToggle: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
  },
  stackTrace: {
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    lineHeight: '1.4',
    padding: '12px',
    borderRadius: '6px',
    overflow: 'auto',
    maxHeight: '200px',
    margin: '8px 0 0 0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

export default ErrorBoundary;