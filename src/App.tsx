import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { VideoPlayer, type VideoPlayerHandle } from './components/VideoPlayer';
import { SubtitleRenderer, type DisplayMode } from './components/SubtitleRenderer';
import { AnalysisCard } from './components/AnalysisCard';
import { StealthMode, type StealthMode as StealthModeType } from './components/StealthMode';
import { SettingsPanel } from './components/SettingsPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ToastProvider, useToast } from './components/Toast';
import { ThemeProvider } from './theme';
import { useKeyboardShortcuts, type ShortcutCallbacks } from './hooks/useKeyboardShortcuts';
import { useABLoop } from './hooks/useABLoop';
import { usePlaybackRate } from './hooks/usePlaybackRate';
import { useSubtitleAnalysis } from './hooks/useSubtitleAnalysis';
import { useProgress, type VideoInfo } from './hooks/useProgress';
import { useVideoSync } from './hooks/useVideoSync';
import { convertFileSrc } from './lib/player/video';
import { detectSubtitleFormat, parseSubtitle } from './lib/subtitle';
import type { SubtitleCue } from './lib/subtitle/types';
import './App.css';

type View = 'home' | 'player';

function AppContent() {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const [currentView, setCurrentView] = useState<View>('home');
  const [currentVideo, setCurrentVideo] = useState<VideoInfo | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [displayMode] = useState<DisplayMode>('word-segmented');
  const [stealthMode, setStealthMode] = useState<StealthModeType>('normal');
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const { currentTime, activeCueIndex } = useVideoSync({
    cues: subtitleCues,
    videoRef: videoElementRef,
  });

  const abLoop = useABLoop({
    videoRef: videoElementRef,
    cues: subtitleCues,
  });

  const playbackRate = usePlaybackRate({ videoRef: videoElementRef });

  const analysis = useSubtitleAnalysis({
    onPauseVideo: useCallback(() => {
      playerRef.current?.pause();
    }, []),
  });

  const progress = useProgress();

  useEffect(() => {
    progress.loadVideoList();
  }, [progress.loadVideoList]);

  useEffect(() => {
    if (currentView === 'player' && currentVideo) {
      progress.loadProgress(currentVideo.id);
      progress.loadLoops(currentVideo.id);
    }
  }, [currentView, currentVideo, progress.loadProgress, progress.loadLoops]);

  useEffect(() => {
    if (currentView !== 'player' || !currentVideo) return;

    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() ?? 0;
      if (time > 0) {
        progress.saveProgress(currentVideo.id, time, playbackRate.currentRate);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentView, currentVideo, progress.saveProgress, playbackRate.currentRate]);

  const handleImportVideo = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Video Files', extensions: ['mp4', 'webm', 'mkv'] }],
      });

      if (selected) {
        setVideoLoading(true);
        const src = await convertFileSrc(selected);
        setVideoSrc(src);
        setSubtitleCues([]);
      }
    } catch (err) {
      console.error('Failed to open video:', err);
    } finally {
      setVideoLoading(false);
    }
  }, []);

  const handleImportSubtitle = useCallback(async () => {
    try {
      setSubtitleLoading(true);
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Subtitle Files', extensions: ['srt', 'ass'] }],
      });

      if (selected) {
        const src = await convertFileSrc(selected);
        const response = await fetch(src);
        const content = await response.text();
        const format = detectSubtitleFormat(content);

        if (format) {
          const cues = parseSubtitle(content, format);
          setSubtitleCues(cues);
        }
      }
    } catch (err) {
      console.error('Failed to load subtitle:', err);
    } finally {
      setSubtitleLoading(false);
    }
  }, []);

  const handleVideoSelect = useCallback((video: VideoInfo) => {
    setCurrentVideo(video);
    setVideoSrc(null);
    setSubtitleCues([]);
    setCurrentView('player');
  }, []);

  const handleBackToHome = useCallback(() => {
    setCurrentView('home');
    setVideoSrc(null);
    setSubtitleCues([]);
    setCurrentVideo(null);
    analysis.closeAnalysis();
    abLoop.clearLoop();
  }, [analysis.closeAnalysis, abLoop.clearLoop]);

  const handleWordClick = useCallback(
    (word: string, cue: SubtitleCue) => {
      analysis.analyzeWord(word, cue, subtitleCues);
    },
    [analysis.analyzeWord, subtitleCues],
  );

  const cycleStealthMode = useCallback(() => {
    const modes: StealthModeType[] = ['normal', 'mini', 'subtitle-bar'];
    const currentIndex = modes.indexOf(stealthMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setStealthMode(modes[nextIndex]);
  }, [stealthMode]);

  const toggleClickThrough = useCallback(() => {
    setIsClickThrough((prev) => !prev);
  }, []);

  const shortcutCallbacks: ShortcutCallbacks = {
    onPlayPause: useCallback(() => {
      const player = playerRef.current;
      if (!player) return;
      const video = videoElementRef.current;
      if (!video) return;
      if (video.paused) {
        player.play();
      } else {
        player.pause();
      }
    }, []),

    onSeekBackward: useCallback(() => {
      const video = videoElementRef.current;
      if (video) {
        video.currentTime = Math.max(0, video.currentTime - 5);
      }
    }, []),

    onSeekForward: useCallback(() => {
      const video = videoElementRef.current;
      if (video) {
        video.currentTime += 5;
      }
    }, []),

    onPreviousSubtitle: useCallback(() => {
      if (activeCueIndex > 0) {
        const video = videoElementRef.current;
        if (video) {
          video.currentTime = subtitleCues[activeCueIndex - 1].startTime;
        }
      }
    }, [activeCueIndex, subtitleCues]),

    onNextSubtitle: useCallback(() => {
      if (activeCueIndex < subtitleCues.length - 1) {
        const video = videoElementRef.current;
        if (video) {
          video.currentTime = subtitleCues[activeCueIndex + 1].startTime;
        }
      }
    }, [activeCueIndex, subtitleCues]),

    onSetAPoint: useCallback(() => {
      const time = videoElementRef.current?.currentTime ?? 0;
      abLoop.setAPoint(time);
    }, [abLoop]),

    onSetBPoint: useCallback(() => {
      const time = videoElementRef.current?.currentTime ?? 0;
      abLoop.setBPoint(time);
    }, [abLoop]),

    onToggleABLoop: useCallback(() => {
      if (abLoop.status === 'ab_set') {
        abLoop.startLoop();
      } else if (abLoop.status === 'looping') {
        abLoop.stopLoop();
      }
    }, [abLoop]),

    onClearABLoop: useCallback(() => {
      abLoop.clearLoop();
    }, [abLoop]),

    onDecreaseSpeed: useCallback(() => {
      playbackRate.decreaseSpeed();
    }, [playbackRate]),

    onIncreaseSpeed: useCallback(() => {
      playbackRate.increaseSpeed();
    }, [playbackRate]),

    onEscape: useCallback(() => {
      if (analysis.analysisResponse || analysis.isLoading) {
        analysis.closeAnalysis();
      } else if (settingsOpen) {
        setSettingsOpen(false);
      }
    }, [analysis, settingsOpen]),

    onToggleStealth: cycleStealthMode,

    onToggleClickThrough: toggleClickThrough,

    onOpenSettings: useCallback(() => {
      setSettingsOpen(true);
    }, []),
  };

  const { osdMessage } = useKeyboardShortcuts(shortcutCallbacks);

  const renderOsd = () => {
    const messages = [osdMessage, abLoop.osdMessage, playbackRate.osdMessage].filter(
      (m): m is string => m !== null,
    );
    if (messages.length === 0) return null;
    return (
      <div style={styles.osd} data-testid="osd-message">
        {messages[messages.length - 1]}
      </div>
    );
  };

  const renderHome = () => (
    <div style={styles.homeContainer} data-testid="home-page">
      <div style={styles.homeHeader}>
        <h1 style={styles.homeTitle}>JoJo Listen</h1>
        <p style={styles.homeSubtitle}>Language learning through video immersion</p>
      </div>

      <div style={styles.homeActions}>
        <button style={styles.importButton} onClick={handleImportVideo} data-testid="import-video-button">
          📂 Import Video
        </button>
        <button
          style={styles.importButton}
          onClick={handleImportSubtitle}
          disabled={!videoSrc}
          data-testid="import-subtitle-button"
        >
          📝 Import Subtitle
        </button>
      </div>

      {videoLoading && <LoadingSpinner message="Loading video..." />}

      {videoSrc && (
        <div style={styles.playerSection} data-testid="player-section">
          <VideoPlayer ref={playerRef} />
          <button style={styles.backButton} onClick={handleBackToHome} data-testid="back-home-button">
            ← Back to Library
          </button>
        </div>
      )}

      <div style={styles.videoList} data-testid="video-list">
        <h2 style={styles.sectionTitle}>Library</h2>
        {progress.videoList.length === 0 ? (
          <p style={styles.emptyMessage}>No videos yet. Import a video to get started.</p>
        ) : (
          progress.videoList.map((video) => (
            <div
              key={video.id}
              style={styles.videoCard}
              onClick={() => handleVideoSelect(video)}
              data-testid={`video-card-${video.id}`}
            >
              <div style={styles.videoCardInfo}>
                <span style={styles.videoFileName}>{video.fileName}</span>
                <span style={styles.videoMeta}>
                  Watched {video.watchCount}x · {video.progressPercent}% complete
                </span>
              </div>
              {video.lastWatchedAt && (
                <span style={styles.videoDate}>
                  Last: {new Date(video.lastWatchedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPlayer = () => (
    <div style={styles.playerContainer} data-testid="player-page">
      {renderOsd()}

      <StealthMode
        currentMode={stealthMode}
        onModeChange={setStealthMode}
        isClickThrough={isClickThrough}
        onToggleClickThrough={toggleClickThrough}
        subtitleContent={
          subtitleCues.length > 0 ? (
            <SubtitleRenderer
              cues={subtitleCues}
              activeCueIndex={activeCueIndex}
              currentTime={currentTime}
              displayMode={displayMode}
              onWordClick={handleWordClick}
            />
          ) : undefined
        }
      >
        <div style={styles.playerWrapper}>
          <div style={styles.playerTopBar}>
            <button style={styles.iconButton} onClick={handleBackToHome} data-testid="back-home-button-player">
              ←
            </button>
            <span style={styles.playerTitle}>{currentVideo?.fileName ?? 'Player'}</span>
            <div style={styles.playerTopBarActions}>
              <button style={styles.iconButton} onClick={handleImportVideo} data-testid="import-video-player">
                📂
              </button>
              <button
                style={styles.iconButton}
                onClick={handleImportSubtitle}
                data-testid="import-subtitle-player"
              >
                📝
              </button>
            </div>
          </div>

          <VideoPlayer ref={playerRef} />

          {subtitleLoading && <LoadingSpinner message="Loading subtitles..." />}

          {abLoop.status !== 'idle' && (
            <div style={styles.abLoopIndicator} data-testid="ab-loop-indicator">
              {abLoop.status === 'a_set' && `A: ${abLoop.aTime?.toFixed(1)}s`}
              {abLoop.status === 'ab_set' && `A: ${abLoop.aTime?.toFixed(1)}s → B: ${abLoop.bTime?.toFixed(1)}s`}
              {abLoop.status === 'looping' && `🔁 A: ${abLoop.aTime?.toFixed(1)}s → B: ${abLoop.bTime?.toFixed(1)}s`}
            </div>
          )}

          <div style={styles.playbackRateIndicator} data-testid="playback-rate-indicator">
            {playbackRate.currentRate}x
          </div>
        </div>
      </StealthMode>

      {(analysis.analysisResponse || analysis.isLoading || analysis.error) && (
        <AnalysisCard
          response={analysis.analysisResponse}
          isLoading={analysis.isLoading}
          error={analysis.error}
          onClose={analysis.closeAnalysis}
          onRetry={analysis.retry}
        />
      )}

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );

  return (
    <div style={styles.appRoot} data-testid="app-root">
      {currentView === 'home' ? renderHome() : renderPlayer()}
    </div>
  );
}

function GlobalErrorHandler({ children }: { children: ReactNode }) {
  const { addToast } = useToast();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[GlobalErrorHandler] Unhandled promise rejection:', event.reason);
      const message = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason ?? 'An unexpected error occurred');
      addToast('error', `Unexpected error: ${message}`);
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [addToast]);

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <GlobalErrorHandler>
            <AppContent />
          </GlobalErrorHandler>
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appRoot: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  homeContainer: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
  },
  homeHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  homeTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  homeSubtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  homeActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  importButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
  playerSection: {
    marginBottom: '24px',
  },
  backButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '12px',
  },
  videoList: {
    marginTop: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  emptyMessage: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    textAlign: 'center',
    padding: '24px',
  },
  videoCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'var(--input-bg)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
  videoCardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  videoFileName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  videoMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  videoDate: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  playerContainer: {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
  },
  playerWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  playerTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  },
  playerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    flex: 1,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerTopBarActions: {
    display: 'flex',
    gap: '8px',
  },
  iconButton: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
  osd: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#ffffff',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    zIndex: 300,
    pointerEvents: 'none',
  },
  abLoopIndicator: {
    position: 'absolute',
    bottom: '80px',
    left: '12px',
    padding: '4px 12px',
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    color: 'var(--accent)',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  playbackRateIndicator: {
    position: 'absolute',
    bottom: '80px',
    right: '12px',
    padding: '4px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#ffffff',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
};

export default App;