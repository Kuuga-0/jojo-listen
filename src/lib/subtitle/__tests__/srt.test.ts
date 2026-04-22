import { describe, it, expect } from 'vitest';
import { parseSRT } from '../parser';

describe('parseSRT - basic parsing', () => {
  it('should parse a simple SRT cue', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Hello World`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual({
      id: '1',
      startTime: 1,
      endTime: 3,
      text: 'Hello World',
      originalText: 'Hello World',
    });
  });

  it('should parse multiple SRT cues', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
First

2
00:00:05,000 --> 00:00:07,500
Second`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('First');
    expect(cues[1].text).toBe('Second');
  });

  it('should handle large timestamps', () => {
    const srt = `1
01:30:45,500 --> 01:35:20,000
Long video`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBeCloseTo(5445.5, 2);
    expect(cues[0].endTime).toBeCloseTo(5720, 2);
  });
});

describe('parseSRT - multi-line text', () => {
  it('should join multi-line text with spaces', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Line one Line two');
  });

  it('should preserve original text with newlines', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two`;

    const cues = parseSRT(srt);
    expect(cues[0].originalText).toBe('Line one\nLine two');
  });
});

describe('parseSRT - HTML tags', () => {
  it('should strip italic tags from text', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<i>Emphasized</i>`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('Emphasized');
    expect(cues[0].originalText).toBe('<i>Emphasized</i>');
  });

  it('should strip bold tags', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<b>Bold text</b>`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('Bold text');
  });

  it('should strip font tags with attributes', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<font color="#ff0000">Red text</font>`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('Red text');
  });

  it('should strip nested tags', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<i><b>Bold and italic</b></i>`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('Bold and italic');
  });

  it('should strip underline tags', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<u>Underlined</u>`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('Underlined');
  });
});

describe('parseSRT - BOM handling', () => {
  it('should handle UTF-8 BOM at start of file', () => {
    const srt = '\uFEFF1\n00:00:01,000 --> 00:00:03,000\nHello';

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });
});

describe('parseSRT - line endings', () => {
  it('should handle CRLF line endings', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:03,000\r\nHello';

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });

  it('should handle CR line endings', () => {
    const srt = '1\r00:00:01,000 --> 00:00:03,000\rHello';

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });
});

describe('parseSRT - error handling', () => {
  it('should skip empty cues', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000


2
00:00:05,000 --> 00:00:07,000
Valid`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Valid');
  });

  it('should skip cues with malformed timestamps', () => {
    const srt = `1
invalid timestamp
Bad cue

2
00:00:05,000 --> 00:00:07,000
Good cue`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Good cue');
  });

  it('should skip cues where start >= end', () => {
    const srt = `1
00:00:05,000 --> 00:00:03,000
Backwards time`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(0);
  });

  it('should return empty array for empty content', () => {
    expect(parseSRT('')).toHaveLength(0);
  });

  it('should return empty array for whitespace-only content', () => {
    expect(parseSRT('   \n\n   ')).toHaveLength(0);
  });

  it('should skip cues with no text', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(0);
  });

  it('should handle period separator in timestamps', () => {
    const srt = `1
00:00:01.000 --> 00:00:03.000
Hello`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBe(1);
    expect(cues[0].endTime).toBe(3);
  });
});

describe('parseSRT - special characters', () => {
  it('should handle unicode text', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
こんにちは世界`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('こんにちは世界');
  });

  it('should handle emoji in text', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Hello 🎬`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe('Hello 🎬');
  });
});