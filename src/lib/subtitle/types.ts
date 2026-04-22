/**
 * Subtitle format types supported by the parser.
 */
export type SubtitleFormat = 'srt' | 'ass';

/**
 * A single subtitle cue representing one timed text entry.
 */
export interface SubtitleCue {
  /** Unique identifier (SRT sequence number or ASS ID) */
  id: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Cleaned text with HTML tags stripped */
  text: string;
  /** Original text with HTML/formatting tags preserved */
  originalText: string;
}