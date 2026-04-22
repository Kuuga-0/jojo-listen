import { describe, it, expect } from 'vitest';
import { stripBOM, stripHtmlTags, parseSRTTime, parseASSTime, formatTime, detectSubtitleFormat, parseSubtitle } from '../parser';

describe('stripBOM', () => {
  it('should remove UTF-8 BOM from string start', () => {
    const bom = '\uFEFF';
    expect(stripBOM(bom + 'hello')).toBe('hello');
  });

  it('should return string unchanged if no BOM', () => {
    expect(stripBOM('hello')).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(stripBOM('')).toBe('');
  });

  it('should not remove BOM-like characters in the middle', () => {
    const text = 'hello\uFEFFworld';
    expect(stripBOM(text)).toBe('hello\uFEFFworld');
  });
});

describe('stripHtmlTags', () => {
  it('should remove italic tags', () => {
    expect(stripHtmlTags('<i>Hello</i>')).toBe('Hello');
  });

  it('should remove bold tags', () => {
    expect(stripHtmlTags('<b>Bold</b> text')).toBe('Bold text');
  });

  it('should remove underline tags', () => {
    expect(stripHtmlTags('<u>Underlined</u>')).toBe('Underlined');
  });

  it('should remove font tags with attributes', () => {
    expect(stripHtmlTags('<font color="#ff0000">Red</font>')).toBe('Red');
  });

  it('should remove multiple nested tags', () => {
    expect(stripHtmlTags('<i><b>Bold italic</b></i>')).toBe('Bold italic');
  });

  it('should handle text without tags', () => {
    expect(stripHtmlTags('Plain text')).toBe('Plain text');
  });

  it('should handle empty string', () => {
    expect(stripHtmlTags('')).toBe('');
  });

  it('should remove self-closing tags', () => {
    expect(stripHtmlTags('Line 1<br/>Line 2')).toBe('Line 1Line 2');
  });
});

describe('parseSRTTime', () => {
  it('should parse standard SRT timestamp', () => {
    expect(parseSRTTime('00:02:17,440')).toBeCloseTo(137.44, 2);
  });

  it('should parse zero timestamp', () => {
    expect(parseSRTTime('00:00:00,000')).toBe(0);
  });

  it('should parse hours correctly', () => {
    expect(parseSRTTime('01:30:45,500')).toBeCloseTo(5445.5, 2);
  });

  it('should handle comma separator', () => {
    expect(parseSRTTime('00:01:23,456')).toBeCloseTo(83.456, 3);
  });

  it('should handle period separator', () => {
    expect(parseSRTTime('00:01:23.456')).toBeCloseTo(83.456, 3);
  });

  it('should return -1 for invalid format', () => {
    expect(parseSRTTime('invalid')).toBe(-1);
  });

  it('should return -1 for empty string', () => {
    expect(parseSRTTime('')).toBe(-1);
  });

  it('should return -1 for partial timestamp', () => {
    expect(parseSRTTime('01:23')).toBe(-1);
  });
});

describe('parseASSTime', () => {
  it('should parse standard ASS timestamp', () => {
    expect(parseASSTime('0:02:17.44')).toBeCloseTo(137.44, 2);
  });

  it('should parse zero timestamp', () => {
    expect(parseASSTime('0:00:00.00')).toBe(0);
  });

  it('should parse hours correctly', () => {
    expect(parseASSTime('1:30:45.50')).toBeCloseTo(5445.5, 2);
  });

  it('should handle centiseconds', () => {
    expect(parseASSTime('0:01:23.99')).toBeCloseTo(83.99, 2);
  });

  it('should return -1 for invalid format', () => {
    expect(parseASSTime('invalid')).toBe(-1);
  });

  it('should return -1 for empty string', () => {
    expect(parseASSTime('')).toBe(-1);
  });
});

describe('formatTime', () => {
  it('should format zero seconds', () => {
    expect(formatTime(0)).toBe('00:00:00,000');
  });

  it('should format with milliseconds', () => {
    expect(formatTime(137.44)).toBe('00:02:17,440');
  });

  it('should format hours', () => {
    expect(formatTime(3661.5)).toBe('01:01:01,500');
  });

  it('should format with leading zeros', () => {
    expect(formatTime(5.007)).toBe('00:00:05,007');
  });
});

describe('detectSubtitleFormat', () => {
  it('should detect ASS format from Script Info header', () => {
    const content = '[Script Info]\nTitle: Test\n[V4+ Styles]\nFormat: Name\n[Events]\nFormat: Layer, Start, End, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello';
    expect(detectSubtitleFormat(content)).toBe('ass');
  });

  it('should detect ASS format from V4+ Styles section', () => {
    const content = '[V4+ Styles]\nFormat: Name\n[Events]\nFormat: Layer, Start, End, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello';
    expect(detectSubtitleFormat(content)).toBe('ass');
  });

  it('should detect SRT format from timestamp pattern', () => {
    const content = '1\n00:00:01,000 --> 00:00:03,000\nHello';
    expect(detectSubtitleFormat(content)).toBe('srt');
  });

  it('should return null for unrecognized content', () => {
    expect(detectSubtitleFormat('Just some random text')).toBeNull();
  });

  it('should return null for empty content', () => {
    expect(detectSubtitleFormat('')).toBeNull();
  });

  it('should handle BOM-prefixed content', () => {
    const content = '\uFEFF[Script Info]\nTitle: Test';
    expect(detectSubtitleFormat(content)).toBe('ass');
  });
});

describe('parseSubtitle', () => {
  it('should delegate to SRT parser for srt format', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,000\nHello';
    const cues = parseSubtitle(srt, 'srt');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });

  it('should delegate to ASS parser for ass format', () => {
    const ass = '[Script Info]\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hello';
    const cues = parseSubtitle(ass, 'ass');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });

  it('should return empty array for unknown format string', () => {
    expect(parseSubtitle('content', 'srt' as any)).toBeDefined();
  });
});