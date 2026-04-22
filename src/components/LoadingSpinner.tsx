interface LoadingSpinnerProps {
  /** Optional message to display below the spinner */
  message?: string;
  /** Size of the spinner in pixels (default: 40) */
  size?: number;
}

export function LoadingSpinner({ message, size = 40 }: LoadingSpinnerProps) {
  return (
    <div style={styles.container} data-testid="loading-spinner">
      <div
        style={{
          ...styles.spinner,
          width: `${size}px`,
          height: `${size}px`,
          borderWidth: `${Math.max(2, size / 12)}px`,
        }}
      />
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    gap: '12px',
  },
  spinner: {
    borderStyle: 'solid',
    borderColor: 'rgba(108, 99, 255, 0.3)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  message: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    margin: 0,
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default LoadingSpinner;