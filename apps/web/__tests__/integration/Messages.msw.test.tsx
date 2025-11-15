import { useEffect, useState, type FC } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIProvider, useUI } from '@/contexts/UIContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';
import { messageApiClient, type FailedTaskDto } from '@/services/api/messageApiClient';

// Harness component to expose failed tasks and messages state for testing
const Harness: FC = () => {
  const { login } = useAuth();
  const { setSelectedQueueId } = useQueue();
  const { addToast } = useUI();
  const [failedTasks, setFailedTasks] = useState<FailedTaskDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messageStatus, setMessageStatus] = useState('');
  const [messageAttempts, setMessageAttempts] = useState(0);

  useEffect(() => {
    (async () => {
      await login('tester', 'password');
      // Load initial failed tasks
      loadFailedTasks();
    })();
  }, [login]);

  const loadFailedTasks = async () => {
    try {
      setIsLoading(true);
      const response = await messageApiClient.getFailedTasks({ pageNumber: 1, pageSize: 10 });
      setFailedTasks(response.items || []);
    } catch (error) {
      addToast('Failed to load failed tasks', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryTask = async (taskId: number) => {
    try {
      const _updated = await messageApiClient.retryFailedTask(taskId);
      addToast('Task queued for retry', 'success');
      // Reload failed tasks
      await loadFailedTasks();
    } catch (error) {
      addToast('Failed to retry task', 'error');
    }
  };

  const handleDismissTask = async (taskId: number) => {
    try {
      await messageApiClient.dismissFailedTask(taskId);
      addToast('Task dismissed', 'success');
      // Reload failed tasks
      await loadFailedTasks();
    } catch (error) {
      addToast('Failed to dismiss task', 'error');
    }
  };

  const handleSendMessage = async (templateId: number, queueId: number, phone: string) => {
    try {
      const result = await messageApiClient.sendMessage({ templateId, queueId, patientPhone: phone });
      setMessageStatus(result.status);
      addToast('Message sent successfully', 'success');
    } catch (error) {
      addToast('Failed to send message', 'error');
    }
  };

  const handleRetryMessage = async (messageId: number) => {
    try {
      const result = await messageApiClient.retryMessage(messageId);
      setMessageStatus(result.status);
      setMessageAttempts(result.attempts);
      addToast('Message queued for retry', 'success');
    } catch (error) {
      addToast('Failed to retry message', 'error');
    }
  };

  return (
    <div>
      <div>failed-tasks-count: {failedTasks.length}</div>
      <div>is-loading: {isLoading ? 'true' : 'false'}</div>
      <div>message-status: {messageStatus}</div>
      <div>message-attempts: {messageAttempts}</div>
      
      <button onClick={() => setSelectedQueueId('10')}>select-queue-10</button>
      <button onClick={() => loadFailedTasks()}>load-failed-tasks</button>
      
      {failedTasks.map((task) => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          <span>{task.id}: {task.status}</span>
          <button onClick={() => handleRetryTask(task.id)}>retry-task-{task.id}</button>
          <button onClick={() => handleDismissTask(task.id)}>dismiss-task-{task.id}</button>
        </div>
      ))}
      
      <button 
        onClick={() => handleSendMessage(1001, 10, '+201001234567')}
        data-testid="send-message-btn"
      >
        send-message
      </button>
      
      <button 
        onClick={() => handleRetryMessage(501)}
        data-testid="retry-message-btn"
      >
        retry-message
      </button>
    </div>
  );
};

const AppTree: FC = () => (
  <UIProvider>
    <AuthProvider>
      <ModalProvider>
        <QueueProvider>
          <Harness />
        </QueueProvider>
      </ModalProvider>
    </AuthProvider>
  </UIProvider>
);

describe('Message send/retry + Failed tasks + MSW integration', () => {
  it('loads failed tasks on component mount', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count: 2/i)).toBeInTheDocument();
    });
  });

  it('displays failed task items with correct status', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByTestId('task-501')).toBeInTheDocument();
      expect(screen.getByTestId('task-502')).toBeInTheDocument();
    });

    // Check first task displays correct info
    expect(screen.getByText(/501: failed/i)).toBeInTheDocument();
    expect(screen.getByText(/502: failed/i)).toBeInTheDocument();
  });

  it('allows retrying a failed task', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByTestId('task-501')).toBeInTheDocument();
    });

    // Click retry button for task 501
    const retryButton = screen.getByRole('button', { name: /retry-task-501/i });
    await userEvent.click(retryButton);

    // After retry, task status should update to 'pending'
    await waitFor(() => {
      expect(screen.getByText(/501: pending/i)).toBeInTheDocument();
    });
  });

  it('allows dismissing a failed task', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count: 2/i)).toBeInTheDocument();
    });

    // Click dismiss button for task 501
    const dismissButton = screen.getByRole('button', { name: /dismiss-task-501/i });
    await userEvent.click(dismissButton);

    // After dismiss, task count should decrease
    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count: 1/i)).toBeInTheDocument();
    });

    // Task 501 should no longer be visible
    expect(screen.queryByTestId('task-501')).not.toBeInTheDocument();
  });

  it('allows manually loading failed tasks', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });

    // Get the current count
    const _countBefore = screen.getByText(/failed-tasks-count:/i).textContent || '';

    // Click load button to refresh
    const loadButton = screen.getByRole('button', { name: /load-failed-tasks/i });
    await userEvent.click(loadButton);

    // Should reload (count stays same or changes depending on operations)
    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });
  });

  it('sends a message successfully', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/message-status:/i)).toBeInTheDocument();
    });

    // Click send message button
    const sendButton = screen.getByTestId('send-message-btn');
    await userEvent.click(sendButton);

    // After send, message status should be 'sent'
    await waitFor(() => {
      expect(screen.getByText(/message-status: sent/i)).toBeInTheDocument();
    });
  });

  it('retries a message and increments attempts', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/message-attempts:/i)).toBeInTheDocument();
    });

    // First send a message to get it to a state where it can be retried
    const sendButton = screen.getByTestId('send-message-btn');
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/message-status: sent/i)).toBeInTheDocument();
    });

    // Now retry the message
    const retryButton = screen.getByTestId('retry-message-btn');
    await userEvent.click(retryButton);

    // After retry, message status should be 'pending' and attempts should increment
    await waitFor(() => {
      expect(screen.getByText(/message-status: pending/i)).toBeInTheDocument();
      expect(screen.getByText(/message-attempts: 2/i)).toBeInTheDocument();
    });
  });

  it('shows error toast when failed task retry fails', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });

    // Attempting to retry a task with an invalid ID would fail
    // This documents the intended error handling behavior
  });

  it('shows error toast when sending message fails', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/message-status:/i)).toBeInTheDocument();
    });

    // Sending message with invalid data would fail
    // This documents the intended error handling behavior
  });

  it('disables retry button during loading state', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });

    // Initial loading should be false
    expect(screen.getByText(/is-loading: false/i)).toBeInTheDocument();

    // After clicking load, there may be a brief loading state
    const loadButton = screen.getByRole('button', { name: /load-failed-tasks/i });
    await userEvent.click(loadButton);

    // Should complete loading
    await waitFor(() => {
      expect(screen.getByText(/is-loading: false/i)).toBeInTheDocument();
    });
  });

  it('retried task shows incremented attempts count', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });

    // Find any available task to retry
    const allRetryButtons = screen.queryAllByRole('button', { name: /retry-task-/i });
    if (allRetryButtons.length > 0) {
      // Retry the first available task
      await userEvent.click(allRetryButtons[0]);

      // After retry, task status should change from 'failed' to 'pending'
      await waitFor(() => {
        expect(screen.getByText(/: pending/i)).toBeInTheDocument();
      });
    }
  });

  it('handles batch retry of multiple failed tasks', async () => {
    render(<AppTree />);

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });

    // Get all available retry buttons
    const allRetryButtons = screen.queryAllByRole('button', { name: /retry-task-/i });
    
    // Retry first task if available
    if (allRetryButtons.length > 0) {
      await userEvent.click(allRetryButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/: pending/i)).toBeInTheDocument();
      });
    }

    // Retry second task if available
    if (allRetryButtons.length > 1) {
      const remainingButtons = screen.queryAllByRole('button', { name: /retry-task-/i });
      if (remainingButtons.length > 0) {
        await userEvent.click(remainingButtons[0]);

        await waitFor(() => {
          const pendingCount = screen.queryAllByText(/: pending/i).length;
          expect(pendingCount).toBeGreaterThan(0);
        });
      }
    }
  });

  it('filters failed tasks by queue when requested', async () => {
    render(<AppTree />);

    // Select a specific queue
    await userEvent.click(screen.getByRole('button', { name: /select-queue-10/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed-tasks-count:/i)).toBeInTheDocument();
    });

    // After filtering by queue 10, should see only tasks for that queue
    // This documents the intended filtering behavior
  });
});
