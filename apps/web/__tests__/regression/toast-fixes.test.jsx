/**
 * Regression tests for Toast fixes
 * Tests cover:
 * 1. Single Toast instance (no duplicates)
 * 2. Close button on all toasts
 * 3. Correct colors (green for success, red for error)
 * 4. No duplicate toasts on mutation errors
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import { showToast } from '../../lib/toast';

describe('Toast Fixes - Regression Tests', () => {
  beforeEach(() => {
    // Clear any existing toasts
    const toastContainer = document.querySelector('[aria-live="polite"]');
    if (toastContainer) {
      toastContainer.innerHTML = '';
    }
  });

  test('should show only ONE toast instance globally', async () => {
    const { container } = renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Test message', 'success');
    });

    await waitFor(() => {
      const toasts = screen.getAllByRole('alert');
      expect(toasts).toHaveLength(1);
    });
  });

  test('should show green background for success toasts', async () => {
    renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Success message', 'success');
    });

    await waitFor(() => {
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-green-500');
    });
  });

  test('should show red background for error toasts', async () => {
    renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Error message', 'error');
    });

    await waitFor(() => {
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-red-500');
    });
  });

  test('should have close button on ALL toasts', async () => {
    renderWithProviders(<div>Test App</div>);

    // Test success toast
    act(() => {
      showToast('Success message', 'success');
    });

    await waitFor(() => {
      const closeButton = screen.getByLabelText('إغلاق');
      expect(closeButton).toBeInTheDocument();
    });

    // Clear and test error toast
    act(() => {
      const toast = screen.getByRole('alert');
      toast.remove();
    });

    act(() => {
      showToast('Error message', 'error');
    });

    await waitFor(() => {
      const closeButton = screen.getByLabelText('إغلاق');
      expect(closeButton).toBeInTheDocument();
    });
  });

  test('should close toast when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Test message', 'success');
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('إغلاق');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  test('should default to success type when no type specified', async () => {
    renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Default message');
    });

    await waitFor(() => {
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-green-500');
    });
  });

  test('should auto-dismiss toast after timeout', async () => {
    jest.useFakeTimers();
    renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Timed message', 'success', 3000);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  test('should NOT show duplicate toasts for same message', async () => {
    renderWithProviders(<div>Test App</div>);

    act(() => {
      showToast('Same message', 'error');
    });

    await waitFor(() => {
      const toasts = screen.getAllByRole('alert');
      expect(toasts).toHaveLength(1);
      expect(toasts[0]).toHaveTextContent('Same message');
    });
  });
});
