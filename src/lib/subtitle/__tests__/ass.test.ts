import { describe, it, expect } from 'vitest';
import { parseASS } from '../parser';

const ASS_HEADER = `[Script Info]
Title: Test
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

describe('parseASS - basic parsing', () => {
  it('should parse a simple ASS dialogue line', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello World`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual({
      id: '0',
      startTime: 1,
      endTime: 3,
      text: 'Hello World',
      originalText: 'Hello World',
    });
  });

  it('should parse multiple dialogue lines', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,First
Dialogue: 0,0:00:05.00,0:00:07.50,Default,,0,0,0,,Second`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('First');
    expect(cues[1].text).toBe('Second');
  });

  it('should handle large timestamps', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,1:30:45.50,1:35:20.00,Default,,0,0,0,,Long video`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].startTime).toBeCloseTo(5445.5, 2);
    expect(cues[0].endTime).toBeCloseTo(5720, 2);
  });
});

describe('parseASS - formatting codes', () => {
  it('should strip bold formatting code', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\b1}Bold{\\b0}`;

    const cues = parseASS(ass);
    expect(cues[0].text).toBe('Bold');
  });

  it('should strip italic formatting code', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\i1}Italic{\\i0}`;

    const cues = parseASS(ass);
    expect(cues[0].text).toBe('Italic');
  });

  it('should convert \\N to newline in originalText', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Line one\\NLine two`;

    const cues = parseASS(ass);
    expect(cues[0].originalText).toBe('Line one\nLine two');
    expect(cues[0].text).toBe('Line one Line two');
  });

  it('should convert \\n to space', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Line one\\nLine two`;

    const cues = parseASS(ass);
    expect(cues[0].originalText).toBe('Line one Line two');
  });

  it('should strip color formatting', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\c&HFF0000&}Red text`;

    const cues = parseASS(ass);
    expect(cues[0].text).toBe('Red text');
  });

  it('should strip multiple formatting codes', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\b1\\i1}Bold Italic{\\b0\\i0}`;

    const cues = parseASS(ass);
    expect(cues[0].text).toBe('Bold Italic');
  });

  it('should handle \\h as space', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello\\hWorld`;

    const cues = parseASS(ass);
    expect(cues[0].text).toBe('Hello World');
  });
});

describe('parseASS - section handling', () => {
  it('should skip Script Info section', () => {
    const ass = `[Script Info]
Title: My Subtitles
ScriptType: v4.00+

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });

  it('should skip V4+ Styles section', () => {
    const cues = parseASS(ASS_HEADER + '\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Test');
    expect(cues.length).toBeGreaterThanOrEqual(1);
  });

  it('should only parse Dialogue lines in Events section', () => {
    const ass = `[Script Info]
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,In Events
Comment: 0,0:00:05.00,0:00:07.00,Default,,0,0,0,,This is a comment`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('In Events');
  });
});

describe('parseASS - error handling', () => {
  it('should skip dialogue lines with invalid timestamps', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,invalid,0:00:03.00,Default,,0,0,0,,Bad timestamp`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(0);
  });

  it('should skip dialogue lines where start >= end', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:05.00,0:00:03.00,Default,,0,0,0,,Backwards`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(0);
  });

  it('should return empty array for content without Events section', () => {
    const ass = `[Script Info]
Title: No events`;

    expect(parseASS(ass)).toHaveLength(0);
  });

  it('should return empty array for empty content', () => {
    expect(parseASS('')).toHaveLength(0);
  });

  it('should handle dialogue with commas in text field', () => {
    const ass = `${ASS_HEADER}
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello, world!`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello, world!');
  });

  it('should skip dialogue lines with missing fields', () => {
    const ass = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00`;

    const cues = parseASS(ass);
    expect(cues).toHaveLength(0);
  });
});

describe('parseASS - BOM handling', () => {
  it('should handle UTF-8 BOM at start of file', () => {
    const ass = '\uFEFF[Script Info]\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello';

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });
});

describe('parseASS - CRLF handling', () => {
  it('should handle CRLF line endings', () => {
    const ass = '[Script Info]\r\n[Events]\r\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\r\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello';

    const cues = parseASS(ass);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });
});