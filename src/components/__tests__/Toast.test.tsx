import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast, type ToastType } from '../Toast';

function TestConsumer({ type, message, duration }: { type: ToastType; message: string; duration?: number }) {
  const { addToast } = useToast();
  return (
    <button
      data-testid="trigger-toast"
      onClick={() => addToast(type, message, duration)}
    >
      Add Toast
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toast when addToast is called', () => {
    render(
      <ToastProvider>
        <TestConsumer type="error" message="Test error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Test error')).toBeTruthy();
  });

  it('renders toast with correct type styling', () => {
    render(
      <ToastProvider>
        <TestConsumer type="success" message="Success!" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    const toast = screen.getByTestId(/toast-toast-/);
    expect(toast).toBeTruthy();
  });

  it('auto-dismisses error toast after 5 seconds', () => {
    render(
      <ToastProvider>
        <TestConsumer type="error" message="Auto dismiss" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Auto dismiss')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Auto dismiss')).toBeNull();
  });

  it('auto-dismisses success toast after 3 seconds', () => {
    render(
      <ToastProvider>
        <TestConsumer type="success" message="Quick dismiss" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Quick dismiss')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Quick dismiss')).toBeNull();
  });

  it('allows custom duration', () => {
    render(
      <ToastProvider>
        <TestConsumer type="info" message="Custom duration" duration={1000} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Custom duration')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Custom duration')).toBeNull();
  });

  it('dismisses toast when dismiss button is clicked', () => {
    render(
      <ToastProvider>
        <TestConsumer type="warning" message="Dismiss me" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Dismiss me')).toBeTruthy();

    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Dismiss me')).toBeNull();
  });

  it('stacks multiple toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer type="info" message="First" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));

    render(
      <ToastProvider>
        <TestConsumer type="error" message="Second" />
        <TestConsumer type="success" message="First" />
      </ToastProvider>,
    );

    expect(screen.getByTestId('toast-container')).toBeTruthy();
  });

  it('limits toasts to maxToasts', () => {
    render(
      <ToastProvider maxToasts={2}>
        <TestConsumer type="info" message="Toast 1" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByTestId('toast-container')).toBeTruthy();
  });

  it('throws if useToast is used outside ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(<TestConsumer type="error" message="fail" />);
    }).toThrow('useToast must be used within a ToastProvider');
    consoleError.mockRestore();
  });

  it('renders toast container with no toasts initially', () => {
    render(
      <ToastProvider>
        <div>No toasts</div>
      </ToastProvider>,
    );

    expect(screen.queryByTestId('toast-container')).toBeNull();
  });

  it('renders all four toast types', () => {
    const { rerender } = render(
      <ToastProvider>
        <TestConsumer type="error" message="Error toast" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Error toast')).toBeTruthy();

    rerender(
      <ToastProvider>
        <TestConsumer type="warning" message="Warning toast" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Warning toast')).toBeTruthy();

    rerender(
      <ToastProvider>
        <TestConsumer type="success" message="Success toast" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Success toast')).toBeTruthy();

    rerender(
      <ToastProvider>
        <TestConsumer type="info" message="Info toast" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId('trigger-toast'));
    expect(screen.getByText('Info toast')).toBeTruthy();
  });
});