import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Toast, { showToast } from '../components/Toast';

describe('Toast Component', () => {
  beforeEach(() => {
    // Clear any timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Restore timers
    jest.useRealTimers();
  });

  test('renders nothing initially', () => {
    render(<Toast />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows message when showToast is called', () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه');
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();
  });

  test('hides message after default timeout', async () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه');
    });

    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();

    // Fast forward 3000ms (default timeout)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByText('رسالة تنبيه')).not.toBeInTheDocument();
    });
  });

  test('respects custom timeout', async () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه', 5000); // 5 second timeout
    });

    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();

    // Fast forward 3000ms (default timeout)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Message should still be visible
    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();

    // Fast forward remaining 2000ms
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByText('رسالة تنبيه')).not.toBeInTheDocument();
    });
  });

  test('handles multiple toast calls', async () => {
    render(<Toast />);
    
    act(() => {
      showToast('الرسالة الأولى');
    });

    expect(screen.getByText('الرسالة الأولى')).toBeInTheDocument();

    // Show second toast immediately
    act(() => {
      showToast('الرسالة الثانية');
    });

    expect(screen.getByText('الرسالة الثانية')).toBeInTheDocument();
    expect(screen.queryByText('الرسالة الأولى')).not.toBeInTheDocument();
  });

  test('has proper aria attributes', () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه');
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  test('applies correct styling', () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه');
    });

    const toast = screen.getByRole('alert');
  expect(toast).toHaveClass('fixed', 'bottom-6', 'right-6', 'z-50');
    expect(toast.firstChild).toHaveClass('bg-black', 'text-white', 'px-4', 'py-2', 'rounded', 'shadow');
  });

  test('cleans up timers on unmount', () => {
    const { unmount } = render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه');
    });

    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();

    unmount();

    // Should not throw errors when timer tries to execute
    act(() => {
      jest.runAllTimers();
    });
  });
});