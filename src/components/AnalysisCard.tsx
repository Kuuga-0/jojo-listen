import { useEffect, useCallback, useState } from 'react';
import type { LLMResponse } from '../lib/llm/types';

export interface AnalysisCardProps {
  response: LLMResponse | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

/**
 * AnalysisCard component displays LLM analysis results in a dark frosted glass style.
 * Full-screen overlay over video area with smooth enter/exit animation.
 */
export function AnalysisCard({
  response,
  isLoading,
  error,
  onClose,
  onRetry,
}: AnalysisCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  if (!response && !isLoading && !error) {
    return null;
  }

  return (
    <div
      style={{
        ...styles.overlay,
        opacity: isExiting ? 0 : isVisible ? 1 : 0,
        transform: isExiting ? 'translateY(20px)' : isVisible ? 'translateY(0)' : 'translateY(20px)',
      }}
      data-testid="analysis-card-overlay"
      onClick={handleClose}
    >
      <div
        style={styles.card}
        data-testid="analysis-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          style={styles.closeButton}
          onClick={handleClose}
          aria-label="Close analysis"
          data-testid="close-button"
        >
          ✕
        </button>

        {isLoading && (
          <div style={styles.loadingContainer} data-testid="loading-state">
            <div style={styles.spinner} />
            <div style={styles.skeletonContainer}>
              <div style={styles.skeletonTitle} />
              <div style={styles.skeletonLine} />
              <div style={styles.skeletonLine} />
              <div style={styles.skeletonLine} />
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div style={styles.errorContainer} data-testid="error-state">
            <div style={styles.errorIcon}>⚠️</div>
            <div style={styles.errorMessage}>{error}</div>
            {onRetry && (
              <button
                style={styles.retryButton}
                onClick={handleRetry}
                data-testid="retry-button"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {response && !isLoading && !error && (
          <div style={styles.contentContainer} data-testid="response-content">
            <div style={styles.translationSection}>
              <h2 style={styles.sectionTitle}>Translation</h2>
              <div style={styles.translationText}>{response.translation}</div>
            </div>

            {response.usage_context.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionSubtitle}>Usage Context</h3>
                <div style={styles.list}>
                  {response.usage_context.map((item, index) => (
                    <div key={index} style={styles.listItem} data-testid="usage-context-item">
                      <div style={styles.exampleText}>{item.example}</div>
                      <div style={styles.explanationText}>{item.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {response.grammar_notes.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionSubtitle}>Grammar Notes</h3>
                <div style={styles.list}>
                  {response.grammar_notes.map((item, index) => (
                    <div key={index} style={styles.listItem} data-testid="grammar-note-item">
                      <div style={styles.pointText}>{item.point}</div>
                      <div style={styles.explanationText}>{item.explanation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {response.vocabulary.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionSubtitle}>Vocabulary</h3>
                <div style={styles.list}>
                  {response.vocabulary.map((item, index) => (
                    <div key={index} style={styles.vocabItem} data-testid="vocabulary-item">
                      <div style={styles.wordHeader}>
                        <span style={styles.wordText}>{item.word}</span>
                        <span style={styles.pronunciationText}>[{item.pronunciation}]</span>
                      </div>
                      <div style={styles.definitionText}>{item.definition}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    transition: 'opacity 200ms ease-out, transform 200ms ease-out',
  },
  card: {
    position: 'relative',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80%',
    backgroundColor: 'var(--bg-primary)',
    backdropFilter: 'var(--blur-md)',
    WebkitBackdropFilter: 'var(--blur-md)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--border)',
    padding: '24px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 200ms ease',
    zIndex: 10,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(108, 99, 255, 0.3)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px',
  },
  skeletonContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  skeletonTitle: {
    height: '24px',
    backgroundColor: 'var(--border)',
    borderRadius: '4px',
    width: '60%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonLine: {
    height: '16px',
    backgroundColor: 'var(--border)',
    borderRadius: '4px',
    width: '100%',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  errorMessage: {
    color: 'var(--text-primary)',
    fontSize: '16px',
    lineHeight: '1.5',
    marginBottom: '20px',
    maxWidth: '400px',
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
  contentContainer: {
    overflowY: 'auto',
    flex: 1,
    paddingRight: '8px',
  },
  translationSection: {
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: {
    color: 'var(--accent)',
    fontSize: '18px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },
  translationText: {
    color: 'var(--text-primary)',
    fontSize: '20px',
    lineHeight: '1.5',
    fontWeight: 500,
  },
  section: {
    marginBottom: '20px',
  },
  sectionSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 12px 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  listItem: {
    padding: '12px',
    backgroundColor: 'var(--input-bg)',
    borderRadius: '8px',
    borderLeft: '3px solid var(--accent)',
  },
  exampleText: {
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px',
    fontStyle: 'italic',
  },
  explanationText: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  pointText: {
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px',
  },
  vocabItem: {
    padding: '12px',
    backgroundColor: 'var(--input-bg)',
    borderRadius: '8px',
  },
  wordHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginBottom: '4px',
  },
  wordText: {
    color: 'var(--text-primary)',
    fontSize: '16px',
    fontWeight: 600,
  },
  pronunciationText: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  definitionText: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    lineHeight: '1.4',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
`;
document.head.appendChild(styleSheet);

export default AnalysisCard;