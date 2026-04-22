import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  segmentWords,
  isContraction,
  isPunctuation,
} from '../segmenter';

describe('isContraction', () => {
  it('identifies n\'t contractions', () => {
    expect(isContraction("don't")).toBe(true);
    expect(isContraction("can't")).toBe(true);
    expect(isContraction("won't")).toBe(true);
    expect(isContraction("isn't")).toBe(true);
    expect(isContraction("aren't")).toBe(true);
    expect(isContraction("wasn't")).toBe(true);
    expect(isContraction("weren't")).toBe(true);
    expect(isContraction("hasn't")).toBe(true);
    expect(isContraction("haven't")).toBe(true);
    expect(isContraction("hadn't")).toBe(true);
    expect(isContraction("doesn't")).toBe(true);
    expect(isContraction("didn't")).toBe(true);
    expect(isContraction("couldn't")).toBe(true);
    expect(isContraction("wouldn't")).toBe(true);
    expect(isContraction("shouldn't")).toBe(true);
    expect(isContraction("mustn't")).toBe(true);
  });

  it('identifies \'m contractions', () => {
    expect(isContraction("I'm")).toBe(true);
  });

  it('identifies \'re contractions', () => {
    expect(isContraction("we're")).toBe(true);
    expect(isContraction("they're")).toBe(true);
    expect(isContraction("you're")).toBe(true);
  });

  it('identifies \'s contractions', () => {
    expect(isContraction("it's")).toBe(true);
    expect(isContraction("that's")).toBe(true);
    expect(isContraction("he's")).toBe(true);
    expect(isContraction("she's")).toBe(true);
  });

  it('identifies \'ve, \'ll, \'d contractions', () => {
    expect(isContraction("I've")).toBe(true);
    expect(isContraction("I'll")).toBe(true);
    expect(isContraction("I'd")).toBe(true);
    expect(isContraction("we've")).toBe(true);
    expect(isContraction("they'll")).toBe(true);
    expect(isContraction("you'd")).toBe(true);
  });

  it('returns false for non-contractions', () => {
    expect(isContraction('hello')).toBe(false);
    expect(isContraction('world')).toBe(false);
    expect(isContraction('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isContraction("DON'T")).toBe(true);
    expect(isContraction("I'M")).toBe(true);
    expect(isContraction("We'Re")).toBe(true);
  });
});

describe('isPunctuation', () => {
  it('identifies common punctuation', () => {
    expect(isPunctuation(',')).toBe(true);
    expect(isPunctuation('.')).toBe(true);
    expect(isPunctuation('!')).toBe(true);
    expect(isPunctuation('?')).toBe(true);
    expect(isPunctuation(':')).toBe(true);
    expect(isPunctuation(';')).toBe(true);
    expect(isPunctuation('(')).toBe(true);
    expect(isPunctuation(')')).toBe(true);
    expect(isPunctuation('"')).toBe(true);
    expect(isPunctuation("'")).toBe(true);
  });

  it('returns false for letters and digits', () => {
    expect(isPunctuation('a')).toBe(false);
    expect(isPunctuation('Z')).toBe(false);
    expect(isPunctuation('0')).toBe(false);
    expect(isPunctuation('9')).toBe(false);
  });

  it('returns false for multi-character strings', () => {
    expect(isPunctuation('ab')).toBe(false);
    expect(isPunctuation('!!')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isPunctuation('')).toBe(false);
  });
});

describe('segmentWords', () => {
  describe('basic word segmentation', () => {
    it('splits "Hello world" into two words', () => {
      const result = segmentWords('Hello world');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ word: 'Hello', isPunctuation: false, startIndex: 0, endIndex: 5 });
      expect(result[1]).toEqual({ word: 'world', isPunctuation: false, startIndex: 6, endIndex: 11 });
    });

    it('splits multiple words separated by spaces', () => {
      const result = segmentWords('one two three');
      expect(result).toHaveLength(3);
      expect(result.map((s) => s.word)).toEqual(['one', 'two', 'three']);
      expect(result.every((s) => !s.isPunctuation)).toBe(true);
    });
  });

  describe('contractions', () => {
    it('treats "don\'t" as a single word', () => {
      const result = segmentWords("don't");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("don't");
      expect(result[0].isPunctuation).toBe(false);
    });

    it('treats "I\'m" as a single word', () => {
      const result = segmentWords("I'm");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("I'm");
    });

    it('treats "can\'t" as a single word', () => {
      const result = segmentWords("can't");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("can't");
    });

    it('treats "won\'t" as a single word', () => {
      const result = segmentWords("won't");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("won't");
    });

    it('treats "they\'re" as a single word', () => {
      const result = segmentWords("they're");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("they're");
    });

    it('treats "it\'s" as a single word', () => {
      const result = segmentWords("it's");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("it's");
    });

    it('handles contractions in a sentence', () => {
      const result = segmentWords("I don't know");
      expect(result.map((s) => s.word)).toEqual(["I", "don't", "know"]);
    });
  });

  describe('punctuation separation', () => {
    it('separates comma from word', () => {
      const result = segmentWords('Hello, world!');
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ word: 'Hello', isPunctuation: false, startIndex: 0, endIndex: 5 });
      expect(result[1]).toEqual({ word: ',', isPunctuation: true, startIndex: 5, endIndex: 6 });
      expect(result[2]).toEqual({ word: 'world', isPunctuation: false, startIndex: 7, endIndex: 12 });
      expect(result[3]).toEqual({ word: '!', isPunctuation: true, startIndex: 12, endIndex: 13 });
    });

    it('separates period from word', () => {
      const result = segmentWords('Hello.');
      expect(result).toHaveLength(2);
      expect(result[0].word).toBe('Hello');
      expect(result[0].isPunctuation).toBe(false);
      expect(result[1].word).toBe('.');
      expect(result[1].isPunctuation).toBe(true);
    });

    it('handles multiple punctuation marks', () => {
      const result = segmentWords('What?!');
      const words = result.map((s) => s.word);
      expect(words).toContain('What');
      expect(words).toContain('?');
      expect(words).toContain('!');
    });

    it('handles parentheses', () => {
      const result = segmentWords('(hello)');
      const words = result.map((s) => s.word);
      expect(words).toContain('(');
      expect(words).toContain('hello');
      expect(words).toContain(')');
    });

    it('handles colon and semicolon', () => {
      const result = segmentWords('yes: no; maybe');
      const words = result.map((s) => s.word);
      expect(words).toContain(':');
      expect(words).toContain(';');
    });
  });

  describe('numbers', () => {
    it('treats "123" as a single word', () => {
      const result = segmentWords('123');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('123');
      expect(result[0].isPunctuation).toBe(false);
    });

    it('treats "3.14" as a single word (decimal number)', () => {
      const result = segmentWords('3.14');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('3.14');
      expect(result[0].isPunctuation).toBe(false);
    });

    it('treats "0.5" as a single word', () => {
      const result = segmentWords('0.5');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('0.5');
    });

    it('separates period after word from decimal in number', () => {
      const result = segmentWords('The value is 3.14.');
      const words = result.map((s) => s.word);
      expect(words).toContain('3.14');
      const decimalIdx = words.indexOf('3.14');
      // The trailing period should be separate punctuation
      expect(result[decimalIdx + 1]?.word).toBe('.');
      expect(result[decimalIdx + 1]?.isPunctuation).toBe(true);
    });
  });

  describe('hyphenated words', () => {
    it('treats "well-known" as a single word', () => {
      const result = segmentWords('well-known');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('well-known');
      expect(result[0].isPunctuation).toBe(false);
    });

    it('treats "state-of-the-art" as a single word', () => {
      const result = segmentWords('state-of-the-art');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('state-of-the-art');
    });

    it('handles hyphenated word in sentence', () => {
      const result = segmentWords('a well-known fact');
      expect(result.map((s) => s.word)).toEqual(['a', 'well-known', 'fact']);
    });
  });

  describe('empty and whitespace', () => {
    it('returns empty array for empty string', () => {
      expect(segmentWords('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(segmentWords('   ')).toEqual([]);
      expect(segmentWords('\t\n')).toEqual([]);
    });

    it('returns empty array for mixed whitespace', () => {
      expect(segmentWords(' \t \n ')).toEqual([]);
    });
  });

  describe('case preservation', () => {
    it('preserves original case', () => {
      const result = segmentWords('HeLLo WoRLD');
      expect(result.map((s) => s.word)).toEqual(['HeLLo', 'WoRLD']);
    });

    it('preserves case in contractions', () => {
      const result = segmentWords("I'M happy");
      expect(result.map((s) => s.word)).toEqual(["I'M", 'happy']);
    });
  });

  describe('index tracking', () => {
    it('tracks correct startIndex and endIndex', () => {
      const result = segmentWords('ab cd');
      expect(result[0].startIndex).toBe(0);
      expect(result[0].endIndex).toBe(2);
      expect(result[1].startIndex).toBe(3);
      expect(result[1].endIndex).toBe(5);
    });

    it('tracks indices with punctuation', () => {
      const result = segmentWords('a, b');
      expect(result[0]).toEqual({ word: 'a', isPunctuation: false, startIndex: 0, endIndex: 1 });
      expect(result[1]).toEqual({ word: ',', isPunctuation: true, startIndex: 1, endIndex: 2 });
      expect(result[2]).toEqual({ word: 'b', isPunctuation: false, startIndex: 3, endIndex: 4 });
    });

    it('tracks indices for contractions', () => {
      const result = segmentWords("it's");
      expect(result[0].startIndex).toBe(0);
      expect(result[0].endIndex).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('handles single character', () => {
      const result = segmentWords('a');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('a');
    });

    it('handles single punctuation', () => {
      const result = segmentWords('!');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('!');
      expect(result[0].isPunctuation).toBe(true);
    });

    it('handles very long text', () => {
      const words = Array(1000).fill('word').join(' ');
      const result = segmentWords(words);
      expect(result).toHaveLength(1000);
      expect(result.every((s) => s.word === 'word')).toBe(true);
    });

    it('handles special characters', () => {
      const result = segmentWords('hello@world');
      const words = result.map((s) => s.word);
      expect(words).toContain('hello');
      expect(words).toContain('@');
      expect(words).toContain('world');
    });

    it('handles consecutive punctuation', () => {
      const result = segmentWords('...');
      expect(result.every((s) => s.isPunctuation)).toBe(true);
      expect(result).toHaveLength(3);
    });
  });

  describe('fallback mechanism', () => {
    let originalSegmenter: unknown;

    beforeEach(() => {
      originalSegmenter = (Intl as unknown as Record<string, unknown>)['Segmenter'];
      (Intl as unknown as Record<string, unknown>)['Segmenter'] = undefined;
    });

    afterEach(() => {
      (Intl as unknown as Record<string, unknown>)['Segmenter'] = originalSegmenter;
    });

    it('uses fallback when Intl.Segmenter is unavailable', () => {
      const result = segmentWords('Hello, world!');
      expect(result).toHaveLength(4);
      expect(result[0].word).toBe('Hello');
      expect(result[1].word).toBe(',');
      expect(result[1].isPunctuation).toBe(true);
      expect(result[2].word).toBe('world');
      expect(result[3].word).toBe('!');
      expect(result[3].isPunctuation).toBe(true);
    });

    it('handles contractions in fallback', () => {
      const result = segmentWords("don't");
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe("don't");
    });

    it('handles decimal numbers in fallback', () => {
      const result = segmentWords('3.14');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('3.14');
    });

    it('handles hyphenated words in fallback', () => {
      const result = segmentWords('well-known');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('well-known');
    });

    it('handles empty string in fallback', () => {
      expect(segmentWords('')).toEqual([]);
    });

    it('handles whitespace-only in fallback', () => {
      expect(segmentWords('   ')).toEqual([]);
    });

    it('preserves case in fallback', () => {
      const result = segmentWords('HeLLo WoRLD');
      expect(result.map((s) => s.word)).toEqual(['HeLLo', 'WoRLD']);
    });

    it('tracks indices correctly in fallback', () => {
      const result = segmentWords('ab cd');
      expect(result[0].startIndex).toBe(0);
      expect(result[0].endIndex).toBe(2);
      expect(result[1].startIndex).toBe(3);
      expect(result[1].endIndex).toBe(5);
    });

    it('handles contraction in sentence via fallback', () => {
      const result = segmentWords("I don't know");
      expect(result.map((s) => s.word)).toEqual(["I", "don't", "know"]);
    });

    it('handles trailing period after word in fallback', () => {
      const result = segmentWords('Hello.');
      expect(result).toHaveLength(2);
      expect(result[0].word).toBe('Hello');
      expect(result[1].word).toBe('.');
      expect(result[1].isPunctuation).toBe(true);
    });
  });
});
