import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleRenderer } from '../SubtitleRenderer';
import type { SubtitleCue } from '../../lib/subtitle/types';

vi.mock('../../lib/subtitle/segmenter', () => ({
  segmentWords: vi.fn((text: string) => {
    // Simple mock implementation that splits by spaces
    const words = text.split(' ');
    let index = 0;
    return words.map((word: string) => {
      const segment = {
        word,
        isPunctuation: /^[.,!?;:]$/.test(word),
        startIndex: index,
        endIndex: index + word.length,
      };
      index += word.length + 1; // +1 for space
      return segment;
    });
  }),
}));

describe('SubtitleRenderer', () => {
  const mockCues: SubtitleCue[] = [
    {
      id: '1',
      startTime: 0,
      endTime: 2,
      text: 'Hello world',
      originalText: 'Hello world',
    },
    {
      id: '2',
      startTime: 2,
      endTime: 4,
      text: 'This is a test',
      originalText: 'This is a test',
    },
    {
      id: '3',
      startTime: 5,
      endTime: 7,
      text: 'Another sentence',
      originalText: 'Another sentence',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering in different display modes', () => {
    it('renders in word-segmented mode', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute('data-display-mode', 'word-segmented');
      expect(screen.getAllByTestId('word').length).toBeGreaterThan(0);
    });

    it('renders in word-segmented-translation mode', () => {
      const translationMap = new Map([['Hello world', '你好世界']]);
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented-translation"
          translationMap={translationMap}
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute(
        'data-display-mode',
        'word-segmented-translation'
      );
      expect(screen.getByTestId('translation-text')).toHaveTextContent(
        '你好世界'
      );
    });

    it('renders in plain mode', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute('data-display-mode', 'plain');
      expect(screen.getByTestId('plain-text')).toHaveTextContent('Hello world');
    });

    it('renders in plain-translation mode', () => {
      const translationMap = new Map([['Hello world', '你好世界']]);
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain-translation"
          translationMap={translationMap}
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute('data-display-mode', 'plain-translation');
      expect(screen.getByTestId('plain-text')).toHaveTextContent('Hello world');
      expect(screen.getByTestId('translation-text')).toHaveTextContent(
        '你好世界'
      );
    });
  });

  describe('word segmentation rendering', () => {
    it('calls segmentWords for word-segmented modes', async () => {
      const { segmentWords } = await import('../../lib/subtitle/segmenter');
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented"
        />
      );

      expect(segmentWords).toHaveBeenCalledWith('Hello world');
    });

    it('renders individual word spans in word-segmented mode', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented"
        />
      );

      const words = screen.getAllByTestId('word');
      expect(words.length).toBe(2); // "Hello" and "world"
      expect(words[0]).toHaveTextContent('Hello');
      expect(words[1]).toHaveTextContent('world');
    });
  });

  describe('current word highlighting', () => {
    it('highlights the first word at the start of the cue', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={0.5} // First half of 2-second cue
          displayMode="word-segmented"
        />
      );

      const words = screen.getAllByTestId('word');
      expect(words[0]).toHaveAttribute('data-active', 'true');
      expect(words[1]).toHaveAttribute('data-active', 'false');
    });

    it('highlights the second word at the end of the cue', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1.5} // Second half of 2-second cue
          displayMode="word-segmented"
        />
      );

      const words = screen.getAllByTestId('word');
      expect(words[0]).toHaveAttribute('data-active', 'false');
      expect(words[1]).toHaveAttribute('data-active', 'true');
    });

  it('changes highlighting as time progresses', () => {
    const { rerender } = render(
      <SubtitleRenderer
        cues={mockCues}
        activeCueIndex={1}
        currentTime={2.25}
        displayMode="word-segmented"
      />
    );

    // At 2.25s (first quarter of 2s cue starting at 2s), first word should be active
    let words = screen.getAllByTestId('word');
    expect(words[0]).toHaveAttribute('data-active', 'true');

    // Rerender with later time
    rerender(
      <SubtitleRenderer
        cues={mockCues}
        activeCueIndex={1}
        currentTime={3.75}
        displayMode="word-segmented"
      />
    );

    // At 3.75s (last quarter of 2s cue), last word should be active
    words = screen.getAllByTestId('word');
    expect(words[words.length - 1]).toHaveAttribute('data-active', 'true');
  });
  });

  describe('click handler', () => {
    it('fires onWordClick when a word is clicked', () => {
      const onWordClick = vi.fn();
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented"
          onWordClick={onWordClick}
        />
      );

      const words = screen.getAllByTestId('word');
      fireEvent.click(words[0]);

      expect(onWordClick).toHaveBeenCalledTimes(1);
      expect(onWordClick).toHaveBeenCalledWith('Hello', mockCues[0]);
    });

    it('does not fire onWordClick for punctuation', () => {
      const onWordClick = vi.fn();
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented"
          onWordClick={onWordClick}
        />
      );

      const punctuation = screen.queryAllByTestId('punctuation');
      if (punctuation.length > 0) {
        fireEvent.click(punctuation[0]);
        expect(onWordClick).not.toHaveBeenCalled();
      }
    });

    it('does not fire onWordClick in plain mode', () => {
      const onWordClick = vi.fn();
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain"
          onWordClick={onWordClick}
        />
      );

      const plainText = screen.getByTestId('plain-text');
      fireEvent.click(plainText);

      expect(onWordClick).not.toHaveBeenCalled();
    });
  });

  describe('gap handling', () => {
    it('displays nothing when no cue is active (between cues)', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={-1}
          currentTime={4.5} // Between cue 2 (ends at 4) and cue 3 (starts at 5)
          displayMode="word-segmented"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveStyle({ opacity: '0' });
      expect(screen.queryByTestId('word')).not.toBeInTheDocument();
      expect(screen.queryByTestId('plain-text')).not.toBeInTheDocument();
    });

    it('displays nothing when activeCueIndex is -1', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={-1}
          currentTime={1}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveStyle({ opacity: '0' });
    });
  });

  describe('transition animation', () => {
    it('applies visible style when cue is active', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveStyle({ opacity: '1' });
    });

    it('applies hidden style when no cue is active', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={-1}
          currentTime={4.5}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveStyle({ opacity: '0' });
    });

    it('has transition style for smooth animation', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer.style.transition).toContain('200ms');
    });
  });

  describe('empty cues array', () => {
    it('renders nothing when cues array is empty', () => {
      render(
        <SubtitleRenderer
          cues={[]}
          activeCueIndex={-1}
          currentTime={0}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveStyle({ opacity: '0' });
      expect(screen.queryByTestId('plain-text')).not.toBeInTheDocument();
    });
  });

  describe('translation map integration', () => {
    it('displays translation when available', () => {
      const translationMap = new Map([
        ['Hello world', '你好世界'],
        ['This is a test', '这是一个测试'],
      ]);

      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain-translation"
          translationMap={translationMap}
        />
      );

      expect(screen.getByTestId('translation-text')).toHaveTextContent(
        '你好世界'
      );
    });

    it('does not display translation when not available', () => {
      const translationMap = new Map([
        ['This is a test', '这是一个测试'],
      ]);

      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain-translation"
          translationMap={translationMap}
        />
      );

      expect(screen.queryByTestId('translation-text')).not.toBeInTheDocument();
    });

    it('does not display translation in non-translation modes', () => {
      const translationMap = new Map([['Hello world', '你好世界']]);

      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="word-segmented"
          translationMap={translationMap}
        />
      );

      expect(screen.queryByTestId('translation-text')).not.toBeInTheDocument();
    });
  });

  describe('data attributes', () => {
    it('sets active-cue-index attribute', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={1}
          currentTime={3}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute('data-active-cue-index', '1');
    });

    it('sets next-cue-index attribute', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={0}
          currentTime={1}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute('data-next-cue-index', '1');
    });

    it('sets next-cue-index to -1 for last cue', () => {
      render(
        <SubtitleRenderer
          cues={mockCues}
          activeCueIndex={2}
          currentTime={6}
          displayMode="plain"
        />
      );

      const renderer = screen.getByTestId('subtitle-renderer');
      expect(renderer).toHaveAttribute('data-next-cue-index', '-1');
    });
  });
});
