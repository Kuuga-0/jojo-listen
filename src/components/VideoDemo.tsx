/**
 * VideoDemo Component
 *
 * Demonstrates HTML5 video playback in Tauri WebView with:
 * - Local MP4 file selection
 * - Play/Pause controls
 * - Playback rate switching (0.5x - 1.5x)
 */

import { useState, useRef, useCallback } from 'react';
import { convertFileSrc, PLAYBACK_RATES, type PlaybackRate } from '../lib/player/video';

export function VideoDemo() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert local file path to webview-compatible URL
      const src = await convertFileSrc(file.name);
      setVideoSrc(src);
      setIsPlaying(false);
    } catch (err) {
      setError(`Failed to load video: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => {
        setError(`Playback error: ${err}`);
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handlePlaybackRateChange = useCallback((rate: PlaybackRate) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Video Demo</h2>

      {/* File Selection */}
      <div style={styles.fileSection}>
        <input
          type="file"
          accept="video/mp4,video/x-mp4"
          onChange={handleFileSelect}
          style={styles.fileInput}
          id="video-file-input"
        />
        <label htmlFor="video-file-input" style={styles.fileLabel}>
          Select MP4 File
        </label>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Video Element */}
      <div style={styles.videoContainer}>
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            style={styles.video}
            onEnded={handleVideoEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div style={styles.placeholder}>
            {isLoading ? 'Loading...' : 'No video selected'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          disabled={!videoSrc}
          style={{
            ...styles.button,
            ...(videoSrc ? styles.buttonEnabled : styles.buttonDisabled),
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Playback Rate Buttons */}
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
              }}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    fontWeight: 600,
  },
  fileSection: {
    marginBottom: '16px',
  },
  fileInput: {
    display: 'none',
  },
  fileLabel: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#4a90d9',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    padding: '8px 12px',
    backgroundColor: '#fee',
    border: '1px solid #c00',
    borderRadius: '4px',
    color: '#c00',
    marginBottom: '12px',
    fontSize: '14px',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '16px',
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
    color: '#666',
    fontSize: '16px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
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
    backgroundColor: '#4a90d9',
    color: 'white',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    color: '#888',
    cursor: 'not-allowed',
  },
  rateContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rateLabel: {
    fontSize: '14px',
    color: '#333',
  },
  rateButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    fontSize: '13px',
    cursor: 'pointer',
  },
  rateButtonActive: {
    backgroundColor: '#4a90d9',
    color: 'white',
    borderColor: '#4a90d9',
  },
};

export default VideoDemo;
