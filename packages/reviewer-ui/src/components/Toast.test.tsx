import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// Helper component to trigger toasts in tests
function ToastTrigger({
  message = 'Test message',
  type = 'success' as const,
  duration,
}: {
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}) {
  const { toast } = useToast();
  return (
    <button onClick={() => toast(message, type, duration)}>
      Show Toast
    </button>
  );
}

function MultiToastTrigger() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast('First toast', 'success')}>Toast 1</button>
      <button onClick={() => toast('Second toast', 'error')}>Toast 2</button>
      <button onClick={() => toast('Third toast', 'warning')}>Toast 3</button>
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Toast', () => {
  it('renders success toast with green styling', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Operation successful" type="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Operation successful');
    expect(alert.className).toContain('bg-green-50');
    expect(alert.className).toContain('border-green-200');
  });

  it('renders error toast with red styling', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Something failed" type="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something failed');
    expect(alert.className).toContain('bg-red-50');
    expect(alert.className).toContain('border-red-200');
  });

  it('renders warning toast with amber styling', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Be careful" type="warning" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Be careful');
    expect(alert.className).toContain('bg-amber-50');
    expect(alert.className).toContain('border-amber-200');
  });

  it('renders info toast with blue styling', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="FYI" type="info" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('FYI');
    expect(alert.className).toContain('bg-blue-50');
    expect(alert.className).toContain('border-blue-200');
  });

  it('auto-dismisses after specified duration', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Vanishing" type="info" duration={2000} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Vanishing')).toBeInTheDocument();

    // Advance past duration
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByText('Vanishing')).not.toBeInTheDocument();
  });

  it('dismisses on X button click', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Dismissable" type="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Dismissable')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Dismissable')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    render(
      <ToastProvider>
        <MultiToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Toast 1'));
    fireEvent.click(screen.getByText('Toast 2'));
    fireEvent.click(screen.getByText('Toast 3'));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('throws error when useToast is used outside provider', () => {
    function BadComponent() {
      useToast();
      return null;
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow(
      'useToast must be used within a ToastProvider',
    );
    spy.mockRestore();
  });
});
