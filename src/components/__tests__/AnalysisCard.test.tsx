import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalysisCard } from '../AnalysisCard';
import type { LLMResponse } from '../../lib/llm/types';

const mockResponse: LLMResponse = {
  translation: 'Hello, how are you today?',
  usage_context: [
    {
      example: 'Hello, how are you today?',
      explanation: 'A common greeting used in casual conversation.',
    },
    {
      example: 'Hi there, how are you doing?',
      explanation: 'A more informal variation of the same greeting.',
    },
  ],
  grammar_notes: [
    {
      point: 'Present Simple Tense',
      explanation: 'Used for habitual actions and general truths.',
    },
    {
      point: 'Question Formation',
      explanation: 'Auxiliary verb "are" comes before the subject.',
    },
  ],
  vocabulary: [
    {
      word: 'hello',
      definition: 'A greeting used when meeting someone.',
      pronunciation: 'həˈloʊ',
    },
    {
      word: 'today',
      definition: 'On or during this present day.',
      pronunciation: 'təˈdeɪ',
    },
  ],
};

describe('AnalysisCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when response is null and not loading/error', () => {
    const { container } = render(
      <AnalysisCard
        response={null}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders loading state with spinner and skeleton', () => {
    render(
      <AnalysisCard
        response={null}
        isLoading={true}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('loading-state')).toBeTruthy();
    expect(screen.getByTestId('analysis-card')).toBeTruthy();
  });

  it('renders error state with error message and retry button', () => {
    const onRetry = vi.fn();
    render(
      <AnalysisCard
        response={null}
        isLoading={false}
        error="Failed to analyze sentence"
        onClose={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId('error-state')).toBeTruthy();
    expect(screen.getByText('Failed to analyze sentence')).toBeTruthy();
    expect(screen.getByTestId('retry-button')).toBeTruthy();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <AnalysisCard
        response={null}
        isLoading={false}
        error="Network error"
        onClose={vi.fn()}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders all LLM response fields correctly', () => {
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    const translationSection = screen.getByText('Translation').closest('div');
    expect(translationSection?.textContent).toContain('Hello, how are you today?');

    const usageItems = screen.getAllByTestId('usage-context-item');
    expect(usageItems).toHaveLength(2);
    expect(screen.getByText('A common greeting used in casual conversation.')).toBeTruthy();

    const grammarItems = screen.getAllByTestId('grammar-note-item');
    expect(grammarItems).toHaveLength(2);
    expect(screen.getByText('Present Simple Tense')).toBeTruthy();

    const vocabItems = screen.getAllByTestId('vocabulary-item');
    expect(vocabItems).toHaveLength(2);
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('[həˈloʊ]')).toBeTruthy();
    expect(screen.getByText('A greeting used when meeting someone.')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={false}
        error={null}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('close-button'));
    waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn();
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={false}
        error={null}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={false}
        error={null}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('analysis-card-overlay'));
    waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('does not close when card content is clicked', () => {
    const onClose = vi.fn();
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={false}
        error={null}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('analysis-card'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders empty sections when arrays are empty', () => {
    const emptyResponse: LLMResponse = {
      translation: 'Test translation',
      usage_context: [],
      grammar_notes: [],
      vocabulary: [],
    };

    render(
      <AnalysisCard
        response={emptyResponse}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Test translation')).toBeTruthy();
    expect(screen.queryByTestId('usage-context-item')).toBeNull();
    expect(screen.queryByTestId('grammar-note-item')).toBeNull();
    expect(screen.queryByTestId('vocabulary-item')).toBeNull();
  });

  it('renders long content with scrollable area', () => {
    const longResponse: LLMResponse = {
      translation: 'A'.repeat(500),
      usage_context: Array.from({ length: 10 }, (_, i) => ({
        example: `Example ${i + 1}`,
        explanation: `Explanation ${i + 1}`.repeat(50),
      })),
      grammar_notes: Array.from({ length: 10 }, (_, i) => ({
        point: `Point ${i + 1}`,
        explanation: `Explanation ${i + 1}`.repeat(50),
      })),
      vocabulary: Array.from({ length: 10 }, (_, i) => ({
        word: `word${i + 1}`,
        definition: `Definition ${i + 1}`.repeat(50),
        pronunciation: `pronunciation${i + 1}`,
      })),
    };

    render(
      <AnalysisCard
        response={longResponse}
        isLoading={false}
        error={null}
        onClose={vi.fn()}
      />
    );

    const contentContainer = screen.getByTestId('response-content');
    expect(contentContainer).toBeTruthy();
    expect(screen.getByText('A'.repeat(500))).toBeTruthy();
  });

  it('shows error state even when response exists', () => {
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={false}
        error="Something went wrong"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('error-state')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByTestId('response-content')).toBeNull();
  });

  it('shows loading state even when response exists', () => {
    render(
      <AnalysisCard
        response={mockResponse}
        isLoading={true}
        error={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('loading-state')).toBeTruthy();
    expect(screen.queryByTestId('response-content')).toBeNull();
  });

  it('renders without onRetry callback', () => {
    render(
      <AnalysisCard
        response={null}
        isLoading={false}
        error="Error without retry"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('error-state')).toBeTruthy();
    expect(screen.queryByTestId('retry-button')).toBeNull();
  });
});