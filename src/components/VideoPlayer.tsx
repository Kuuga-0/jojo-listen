import {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc, PLAYBACK_RATES, type PlaybackRate } from '../lib/player/video';
import { detectSubtitleFormat, parseSubtitle } from '../lib/subtitle';
import type { SubtitleCue } from '../lib/subtitle/types';
import { useVideoSync } from '../hooks/useVideoSync';

type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended';

export interface VideoPlayerHandle {
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: PlaybackRate): void;
  getCurrentTime(): number;
  setVolume(vol: number): void;
}

export interface VideoPlayerProps {
  onSubtitleCuesLoaded?: (cues: SubtitleCue[]) => void;
  className?: string;
}

function formatDisplayTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ onSubtitleCuesLoaded, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1.0);
    const [volume, setVolume] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { currentTime, activeCue, activeCueIndex } = useVideoSync({
      cues,
      videoRef,
    });

    useImperativeHandle(
      ref,
      () => ({
        play: () => videoRef.current?.play() ?? Promise.resolve(),
        pause: () => {
          videoRef.current?.pause();
        },
        seek: (time: number) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        },
        setPlaybackRate: (rate: PlaybackRate) => {
          if (videoRef.current) {
            videoRef.current.playbackRate = rate;
            setPlaybackRate(rate);
          }
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        setVolume: (vol: number) => {
          if (videoRef.current) {
            videoRef.current.volume = Math.max(0, Math.min(1, vol));
            setVolume(Math.max(0, Math.min(1, vol)));
          }
        },
      }),
      [],
    );

    const handleImportVideo = useCallback(async () => {
      try {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: 'Video Files',
              extensions: ['mp4', 'webm', 'mkv'],
            },
          ],
        });

        if (selected) {
          setIsLoading(true);
          setError(null);
          const src = await convertFileSrc(selected);
          setVideoSrc(src);
          setPlaybackState('idle');
          setCues([]);
          setDuration(0);
        }
      } catch (err) {
        setError(`Failed to open video: ${err}`);
      } finally {
        setIsLoading(false);
      }
    }, []);

    const handleImportSubtitle = useCallback(async () => {
      try {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: 'Subtitle Files',
              extensions: ['srt', 'ass'],
            },
          ],
        });

        if (selected) {
          setError(null);
          const src = await convertFileSrc(selected);
          const response = await fetch(src);
          const content = await response.text();
          const format = detectSubtitleFormat(content);

          if (format) {
            const parsedCues = parseSubtitle(content, format);
            setCues(parsedCues);
            onSubtitleCuesLoaded?.(parsedCues);
          } else {
            setError('Unsupported subtitle format. Use .srt or .ass files.');
          }
        }
      } catch (err) {
        setError(`Failed to load subtitle: ${err}`);
      }
    }, [onSubtitleCuesLoaded]);

    const togglePlayPause = useCallback(() => {
      const video = videoRef.current;
      if (!video || !videoSrc) return;

      if (playbackState === 'playing') {
        video.pause();
      } else {
        video.play().catch((err) => {
          setError(`Playback error: ${err}`);
        });
      }
    }, [playbackState, videoSrc]);

    const handleProgressClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        if (!video || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = x / rect.width;
        video.currentTime = ratio * duration;
      },
      [duration],
    );

    const handlePlaybackRateChange = useCallback((rate: PlaybackRate) => {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = rate;
        setPlaybackRate(rate);
      }
    }, []);

    const handleVolumeChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const vol = parseFloat(e.target.value);
        video.volume = vol;
        setVolume(vol);
      },
      [],
    );

    const handleLoadedMetadata = useCallback(() => {
      const video = videoRef.current;
      if (video) {
        setDuration(video.duration);
      }
    }, []);

    const handlePlay = useCallback(() => setPlaybackState('playing'), []);
    const handlePause = useCallback(() => setPlaybackState('paused'), []);
    const handleEnded = useCallback(() => setPlaybackState('ended'), []);

    const handleVideoError = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      const mediaError = video.error;
      let message = 'Video file not found or cannot be played';
      if (mediaError) {
        switch (mediaError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = 'Video playback was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = 'Video format is not supported or file is corrupt';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Video source not supported or file not found';
            break;
        }
      }
      setError(message);
      setIsLoading(false);
    }, []);

    const handleWaiting = useCallback(() => {
      setIsLoading(true);
    }, []);

    const handleCanPlay = useCallback(() => {
      setIsLoading(false);
    }, []);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className={className} style={styles.container}>
        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.videoContainer}>
          {videoSrc ? (
            <>
              <video
                ref={videoRef}
                src={videoSrc}
                style={styles.video}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onError={handleVideoError}
                onWaiting={handleWaiting}
                onCanPlay={handleCanPlay}
              />
              {isLoading && !error && (
                <div style={styles.bufferingOverlay} data-testid="video-buffering">
                  <div style={styles.bufferingSpinner} />
                  <span style={styles.bufferingText}>Buffering...</span>
                </div>
              )}
            </>
          ) : (
            <div style={styles.placeholder}>
              {isLoading ? 'Loading...' : 'Click "Import Video" to select a file'}
            </div>
          )}
        </div>

        <div style={styles.progressBar} onClick={handleProgressClick}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>

        <div style={styles.timeDisplay}>
          <span>{formatDisplayTime(currentTime)}</span>
          <span>{formatDisplayTime(duration)}</span>
        </div>

        <div style={styles.controls}>
          <button
            onClick={togglePlayPause}
            disabled={!videoSrc}
            style={{
              ...styles.button,
              ...(videoSrc ? styles.buttonEnabled : styles.buttonDisabled),
            }}
          >
            {playbackState === 'playing' ? '⏸ Pause' : '▶ Play'}
          </button>

          <div style={styles.rateContainer}>
            <span style={styles.rateLabel}>Speed:</span>
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                onClick={() => handlePlaybackRateChange(rate)}
                disabled={!videoSrc}
                style={{
                  ...styles.rateButton,
                  ...(playbackRate === rate ? styles.rateButtonActive : {}),
                  ...(!videoSrc ? styles.buttonDisabled : {}),
                }}
              >
                {rate}x
              </button>
            ))}
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            disabled={!videoSrc}
            style={styles.volumeSlider}
          />
        </div>

        <div style={styles.importControls}>
          <button onClick={handleImportVideo} style={styles.importButton}>
            📂 Import Video
          </button>
          <button
            onClick={handleImportSubtitle}
            disabled={!videoSrc}
            style={{
              ...styles.importButton,
              ...(!videoSrc ? styles.buttonDisabled : {}),
            }}
          >
            📝 Import Subtitle
          </button>
          {cues.length > 0 && (
            <span style={styles.cueCount}>{cues.length} cues loaded</span>
          )}
        </div>

        {activeCue && (
          <div style={styles.activeCue}>
            <strong>Cue #{activeCueIndex + 1}:</strong> {activeCue.text}
          </div>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = 'VideoPlayer';

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  error: {
    padding: '8px 12px',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid var(--error)',
    borderRadius: '4px',
    color: 'var(--error)',
    marginBottom: '12px',
    fontSize: '14px',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: '16px',
  },
  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: 'var(--border)',
    borderRadius: '3px',
    cursor: 'pointer',
    marginBottom: '4px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--accent)',
    borderRadius: '3px',
    transition: 'width 0.1s linear',
  },
  timeDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '8px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  buttonEnabled: {
    backgroundColor: 'var(--accent)',
    color: 'white',
  },
  buttonDisabled: {
    backgroundColor: 'var(--border)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  },
  rateContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  rateLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginRight: '4px',
  },
  rateButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  rateButtonActive: {
    backgroundColor: 'var(--accent)',
    color: 'white',
    borderColor: 'var(--accent)',
  },
  volumeSlider: {
    width: '80px',
    cursor: 'pointer',
  },
  importControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  importButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  cueCount: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  activeCue: {
    padding: '8px 12px',
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    border: '1px solid var(--accent)',
    borderRadius: '4px',
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  bufferingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--overlay)',
    borderRadius: '8px',
    zIndex: 10,
  },
  bufferingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(232, 232, 240, 0.3)',
    borderTopColor: 'var(--text-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  bufferingText: {
    color: 'var(--text-primary)',
    fontSize: '14px',
    marginTop: '8px',
  },
};

export default VideoPlayer;