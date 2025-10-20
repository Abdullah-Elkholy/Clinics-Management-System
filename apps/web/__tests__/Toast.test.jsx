import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Reset modules and explicitly import the actual Toast component
jest.resetModules();
jest.unmock('../components/Toast');

// Dynamically import the actual components after unmocking
const Toast = require('../components/Toast').default;
const { showToast } = require('../components/Toast');

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
    // This test will use real timers to avoid conflict with global cleanup
    jest.useRealTimers();
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه', 'info', 5000); // 5 second timeout
    });

    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();

    // Wait for a duration less than the timeout
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Message should still be visible
    expect(screen.getByText('رسالة تنبيه')).toBeInTheDocument();

    // Wait for the remainder of the timeout
    await new Promise(resolve => setTimeout(resolve, 2000));

    await waitFor(() => {
      expect(screen.queryByText('رسالة تنبيه')).not.toBeInTheDocument();
    });
    // Switch back to fake timers for other tests
    jest.useFakeTimers();
  }, 7000); // Increase timeout for this long-running test

  test('handles multiple toast calls', async () => {
    render(<Toast />);
    
    act(() => {
      showToast('الرسالة الأولى');
      showToast('الرسالة الثانية');
    });

    expect(screen.getByText('الرسالة الأولى')).toBeInTheDocument();
    expect(screen.getByText('الرسالة الثانية')).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
  });

  test('has proper aria attributes', () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه');
    });

    const alertContainer = screen.getByRole('alert').parentElement.parentElement;
    expect(alertContainer).toHaveAttribute('aria-live', 'polite');
  });

  test('applies correct styling', () => {
    render(<Toast />);
    
    act(() => {
      showToast('رسالة تنبيه', 'info');
    });

    const toast = screen.getByRole('alert');
    const toastContainer = toast.parentElement.parentElement;

    expect(toastContainer).toHaveClass('fixed', 'top-4', 'left-4', 'z-50');
    expect(toast).toHaveClass('bg-red-500');
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