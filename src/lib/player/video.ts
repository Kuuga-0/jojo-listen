// Video player module - Tauri integration
import { invoke } from '@tauri-apps/api/core';

/**
 * Convert a local file path to a webview-compatible URL using Tauri commands.
 * This is needed for HTML5 video src attributes in Tauri WebView.
 *
 * @param path - Local file path (e.g., "C:\Videos\test.mp4")
 * @returns Webview-compatible URL (e.g., "file:///C:/Videos/test.mp4")
 */
export async function convertFileSrc(path: string): Promise<string> {
  return await invoke<string>('convert_file_src', { path });
}

/**
 * Available playback rates for video player
 */
export const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
