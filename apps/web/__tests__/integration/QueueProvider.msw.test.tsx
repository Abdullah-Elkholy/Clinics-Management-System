import { useEffect, type FC } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UIProvider } from '@/contexts/UIContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';

// Small harness component to login then select a queue and display counts
const Harness: FC = () => {
  const { login } = useAuth();
  const { setSelectedQueueId, messageTemplates, messageConditions, addMessageTemplate } = useQueue();

  useEffect(() => {
    (async () => {
      await login('tester', 'password');
    })();
  }, [login]);

  return (
    <div>
      <div>templates-count: {messageTemplates.length}</div>
      <div>conditions-count: {messageConditions.length}</div>
      <button onClick={() => setSelectedQueueId('123')}>select-queue-123</button>
      <button onClick={() => setSelectedQueueId('456')}>select-queue-456</button>
      <button onClick={() => addMessageTemplate({ title: 'New', content: 'Hi', queueId: '456', isDeleted: false, variables: [], createdBy: '', createdAt: new Date() })}>add-template</button>
    </div>
  );
};

const AppTree: FC = () => (
  <UIProvider>
    <AuthProvider>
      <QueueProvider>
        <Harness />
      </QueueProvider>
    </AuthProvider>
  </UIProvider>
);

describe('QueueProvider + MSW integration', () => {
  it('loads templates and conditions from API when queue is selected', async () => {
    render(<AppTree />);

    // Initially zero
    expect(screen.getByText(/templates-count: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/conditions-count: 0/i)).toBeInTheDocument();

    // Select queue id 123 which MSW responds to
  await userEvent.click(screen.getByRole('button', { name: /select-queue-123/i }));

    // Wait for provider to fetch and update state
    await waitFor(() => {
      expect(screen.getByText(/templates-count: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/conditions-count: 1/i)).toBeInTheDocument();
    });
  });

  it('creates a template via API and then reflects it in provider state (queue 456)', async () => {
    render(<AppTree />);

    // Select queue 456 (empty to start)
    await userEvent.click(screen.getByRole('button', { name: /select-queue-456/i }));
    expect(screen.getByText(/templates-count: 0/i)).toBeInTheDocument();

    // Add a template via QueueProvider -> messageApiClient -> MSW
    await userEvent.click(screen.getByRole('button', { name: /add-template/i }));

    // Wait for the optimistic add and server confirmation to settle as 1 item
    await waitFor(() => {
      expect(screen.getByText(/templates-count: 1/i)).toBeInTheDocument();
    });
  });
});
