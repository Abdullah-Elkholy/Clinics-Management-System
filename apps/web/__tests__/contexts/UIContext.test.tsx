import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { UIProvider } from '@/contexts/UIContext';
import { useUI } from '@/contexts/UIContext';

function UIProbe() {
  const { toasts, addToast, currentPanel, setCurrentPanel, selectedQueueId, setSelectedQueueId } = useUI();
  return (
    <div>
      <div data-testid="toasts-count">{toasts.length}</div>
      <div data-testid="panel">{currentPanel}</div>
      <div data-testid="queue">{selectedQueueId ?? ''}</div>
      <button onClick={() => addToast('hello', 'success')}>add-toast</button>
      <button onClick={() => setCurrentPanel('messages')}>set-panel</button>
      <button onClick={() => setSelectedQueueId('q-1')}>set-queue</button>
    </div>
  );
}

describe('UIContext', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('throws when used without provider', () => {
    const Broken = () => {
      useUI();
      return null;
    };

    // Rendering a consumer without provider should throw
    expect(() => render(<Broken />)).toThrow('useUI must be used within UIProvider');
  });

  it('adds toast and auto-removes after timeout; updates panel and queue id', () => {
    jest.useFakeTimers();

    render(
      <UIProvider>
        <UIProbe />
      </UIProvider>
    );

    // Initially 0 toasts
    expect(screen.getByTestId('toasts-count').textContent).toBe('0');

    // Add a toast
    fireEvent.click(screen.getByText('add-toast'));
    expect(screen.getByTestId('toasts-count').textContent).toBe('1');

    // Advance timers to auto-remove after 3s
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('toasts-count').textContent).toBe('0');

    // Change panel
    expect(screen.getByTestId('panel').textContent).toBe('welcome');
    fireEvent.click(screen.getByText('set-panel'));
    expect(screen.getByTestId('panel').textContent).toBe('messages');

    // Change selectedQueueId
    expect(screen.getByTestId('queue').textContent).toBe('');
    fireEvent.click(screen.getByText('set-queue'));
    expect(screen.getByTestId('queue').textContent).toBe('q-1');
  });
});
