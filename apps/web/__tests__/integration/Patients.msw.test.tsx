import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIProvider } from '@/contexts/UIContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';

const Harness: React.FC = () => {
  const { login } = useAuth();
  const { setSelectedQueueId, patients, togglePatientSelection } = useQueue();

  React.useEffect(() => {
    (async () => {
      await login('tester', 'password');
    })();
  }, [login]);

  const firstId = patients[0]?.id;

  return (
    <div>
      <div>patients-count: {patients.length}</div>
      <div>selected-count: {patients.filter(p => p.selected).length}</div>
      <button onClick={() => setSelectedQueueId('789')}>select-queue-789</button>
      <button onClick={() => firstId && togglePatientSelection(firstId)}>toggle-first</button>
    </div>
  );
};

const AppTree: React.FC = () => (
  <UIProvider>
    <AuthProvider>
      <QueueProvider>
        <Harness />
      </QueueProvider>
    </AuthProvider>
  </UIProvider>
);

describe('Patients + MSW integration', () => {
  it('loads patients on queue select and toggles selection for first patient', async () => {
    render(<AppTree />);

    // Initially empty
    expect(screen.getByText(/patients-count: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/selected-count: 0/i)).toBeInTheDocument();

    // Select queue 789 handled by MSW
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));

    // Wait for patients to load
    await waitFor(() => {
      expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument();
    });

    // Toggle selection for first patient
    await userEvent.click(screen.getByRole('button', { name: /toggle-first/i }));

    // Assert selection reflected in context state
    await waitFor(() => {
      expect(screen.getByText(/selected-count: 1/i)).toBeInTheDocument();
    });
  });
});
