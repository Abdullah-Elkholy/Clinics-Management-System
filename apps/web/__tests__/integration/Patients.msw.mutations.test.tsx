import { useEffect, useMemo, type FC } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIProvider } from '@/contexts/UIContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';
import patientsApiClient from '@/services/api/patientsApiClient';

const Harness: FC = () => {
  const { login } = useAuth();
  const { setSelectedQueueId, patients } = useQueue();

  useEffect(() => {
    (async () => {
      await login('tester', 'password');
    })();
  }, [login]);

  const firstByPosition = useMemo(() => {
    if (!patients.length) return '';
    const minPos = Math.min(...patients.map(p => p.position));
    return patients.find(p => p.position === minPos)?.name ?? '';
  }, [patients]);

  return (
    <div>
      <div>patients-count: {patients.length}</div>
  <div>completed-count: {patients.filter(p => p.status === 'completed').length}</div>
      <div>first-position-name: {firstByPosition}</div>
      <button onClick={() => setSelectedQueueId('789')}>select-queue-789</button>
      <button onClick={() => setSelectedQueueId('456')}>select-queue-456</button>
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

describe('Patients + MSW mutations integration', () => {
  it('create, update, delete and reorder patients then reflect in provider after reloads', async () => {
    render(<AppTree />);

    // Load initial patients for queue 789
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));
    await waitFor(() => {
      expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument();
    });

    // Create a third patient via API
    await patientsApiClient.createPatient({ queueId: 789, fullName: 'Sara Nabil', phoneNumber: '+201003003000' });

    // Force reload by switching queues away and back
    await userEvent.click(screen.getByRole('button', { name: /select-queue-456/i }));
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));

    await waitFor(() => {
      expect(screen.getByText(/patients-count: 3/i)).toBeInTheDocument();
    });

    // Mark first patient (id 1) completed
    await patientsApiClient.updatePatient(1, { status: 'completed' });

    // Reload
    await userEvent.click(screen.getByRole('button', { name: /select-queue-456/i }));
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));

    await waitFor(() => {
      expect(screen.getByText(/completed-count: 1/i)).toBeInTheDocument();
    });

    // Delete second patient (id 2)
    await patientsApiClient.deletePatient(2);

    // Reload
    await userEvent.click(screen.getByRole('button', { name: /select-queue-456/i }));
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));

    await waitFor(() => {
      expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument();
    });

    // Reorder: make the third patient (id 3) first
    await patientsApiClient.reorderPatients({ queueId: 789, items: [ { id: 3, position: 1 }, { id: 1, position: 2 } ] });

    // Reload
    await userEvent.click(screen.getByRole('button', { name: /select-queue-456/i }));
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));

    await waitFor(() => {
      expect(screen.getByText(/first-position-name: Sara Nabil/i)).toBeInTheDocument();
    });
  });
});
