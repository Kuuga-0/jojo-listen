/**
 * English word segmentation module.
 *
 * Splits text into individual words, handling contractions, punctuation,
 * and providing fallback when Intl.Segmenter is unavailable.
 */

// Intl.Segmenter types not in ES2020 lib — access at runtime via bracket notation

interface SegmenterSegment {
  segment: string;
  index: number;
  input: string;
  isWordLike?: boolean;
}

interface Segmenter {
  segment(text: string): IterableIterator<SegmenterSegment>;
}

interface SegmenterConstructor {
  new (
    locale?: string | string[],
    options?: { granularity?: 'grapheme' | 'sentence' | 'word' },
  ): Segmenter;
}

function getSegmenterCtor(): SegmenterConstructor | undefined {
  if (typeof Intl === 'undefined') return undefined;
  return (Intl as unknown as Record<string, unknown>)['Segmenter'] as
    | SegmenterConstructor
    | undefined;
}


export interface WordSegment {
  word: string;
  isPunctuation: boolean;
  startIndex: number;
  endIndex: number;
}


const CONTRACTION_SUFFIXES = [
  "n't",
  "'m",
  "'re",
  "'s",
  "'ve",
  "'ll",
  "'d",
] as const;

const PUNCTUATION_CHARS = new Set([
  ',', '.', '!', '?', ':', ';',
  '(', ')', '[', ']', '{', '}',
  '"', "'", '`',
  '\u2014', '\u2013', // em-dash, en-dash
  '-', '/', '\\',
  '&', '*', '%', '$', '#', '@',
  '+', '=', '<', '>', '|', '~', '^',
]);


/**
 * Check if a word is an English contraction.
 *
 * Returns true for words containing an apostrophe that ends with a
 * known contraction suffix (e.g. "don't", "I'm", "we're", "it's").
 */
export function isContraction(word: string): boolean {
  if (!word.includes("'")) return false;
  const lower = word.toLowerCase();
  return CONTRACTION_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Check if a character is punctuation.
 *
 * Returns true for common punctuation marks (comma, period, exclamation,
 * question mark, colon, semicolon, parentheses, quotes, dashes, etc.).
 */
export function isPunctuation(char: string): boolean {
  if (char.length !== 1) return false;
  return PUNCTUATION_CHARS.has(char);
}

function isDigits(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false; // '0' = 48, '9' = 57
  }
  return s.length > 0;
}

function isLetter(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); // A-Z, a-z
}

function isDigit(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 48 && c <= 57;
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}


function segmentWithIntl(text: string, Ctor: SegmenterConstructor): WordSegment[] {
  const segmenter = new Ctor('en', { granularity: 'word' });

  const raw: Array<{ segment: string; index: number; isWordLike: boolean }> = [];
  for (const seg of segmenter.segment(text)) {
    raw.push({ segment: seg.segment, index: seg.index, isWordLike: seg.isWordLike ?? false });
  }

  const nonWs = raw.filter((s) => s.segment.trim().length > 0);
  if (nonWs.length === 0) return [];

  const merged: Array<{ segment: string; startIndex: number; isWordLike: boolean }> = [];
  let i = 0;

  while (i < nonWs.length) {
    const cur = nonWs[i];

    if (cur.isWordLike) {
      // Check for contraction (single merge)
      if (
        i + 2 < nonWs.length &&
        nonWs[i + 1].segment === "'" &&
        !nonWs[i + 1].isWordLike &&
        nonWs[i + 2].isWordLike
      ) {
        const combined = cur.segment + "'" + nonWs[i + 2].segment;
        if (isContraction(combined)) {
          merged.push({ segment: combined, startIndex: cur.index, isWordLike: true });
          i += 3;
          continue;
        }
      }

      // Check for decimal number (single merge)
      if (
        i + 2 < nonWs.length &&
        nonWs[i + 1].segment === '.' &&
        !nonWs[i + 1].isWordLike &&
        nonWs[i + 2].isWordLike &&
        isDigits(cur.segment) &&
        isDigits(nonWs[i + 2].segment)
      ) {
        const combined = cur.segment + '.' + nonWs[i + 2].segment;
        merged.push({ segment: combined, startIndex: cur.index, isWordLike: true });
        i += 3;
        continue;
      }

      // Chain hyphens greedily (well-known, state-of-the-art)
      let combined = cur.segment;
      let combinedStart = cur.index;
      let j = i + 1;
      while (
        j + 1 < nonWs.length &&
        nonWs[j].segment === '-' &&
        !nonWs[j].isWordLike &&
        nonWs[j + 1].isWordLike
      ) {
        combined = combined + '-' + nonWs[j + 1].segment;
        j += 2;
      }

      if (j > i + 1) {
        merged.push({ segment: combined, startIndex: combinedStart, isWordLike: true });
        i = j;
        continue;
      }
    }

    merged.push({ segment: cur.segment, startIndex: cur.index, isWordLike: cur.isWordLike });
    i++;
  }

  return merged.map((m) => ({
    word: m.segment,
    isPunctuation: !m.isWordLike,
    startIndex: m.startIndex,
    endIndex: m.startIndex + m.segment.length,
  }));
}


function segmentFallback(text: string): WordSegment[] {
  const result: WordSegment[] = [];
  let i = 0;

  while (i < text.length) {
    if (isWhitespace(text[i])) { i++; continue; }

    const start = i;
    const ch = text[i];

    if (isLetter(ch) || isDigit(ch)) {
      let word = '';

      while (i < text.length) {
        const c = text[i];
        if (isWhitespace(c)) break;

        if (c === "'") {
          if (i + 1 < text.length && isLetter(text[i + 1])) { word += c; i++; continue; }
          break;
        }

        if (c === '-') {
          if (i + 1 < text.length && isLetter(text[i + 1])) { word += c; i++; continue; }
          break;
        }

        if (c === '.') {
          if (isDigits(word) && i + 1 < text.length && isDigit(text[i + 1])) { word += c; i++; continue; }
          break;
        }

        if (isPunctuation(c)) break;

        word += c;
        i++;
      }

      if (word.length > 0) {
        result.push({ word, isPunctuation: false, startIndex: start, endIndex: start + word.length });
      }
    } else {
      result.push({ word: ch, isPunctuation: true, startIndex: start, endIndex: start + 1 });
      i++;
    }
  }

  return result;
}


export function segmentWords(text: string): WordSegment[] {
  if (!text || !text.trim()) return [];

  const Ctor = getSegmenterCtor();
  if (Ctor) return segmentWithIntl(text, Ctor);
  return segmentFallback(text);
}
