import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIProvider } from '@/contexts/UIContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';
import queuesApiClient from '@/services/api/queuesApiClient';

const Harness: React.FC<{ remount: number; onRemount: () => void }> = ({ remount, onRemount }) => {
  const { login } = useAuth();
  const { queues } = useQueue();

  React.useEffect(() => {
    (async () => {
      await login('tester', 'password');
    })();
  }, [login]);

  const firstId = queues[0]?.id;

  return (
    <div>
      <div>queues-count: {queues.length}</div>
      <div>first-doctor: {queues[0]?.doctorName ?? ''}</div>
      <button onClick={async () => {
        await queuesApiClient.createQueue({ doctorName: 'Dr Three', createdBy: 102, moderatorId: 102, currentPosition: 0, isActive: true });
      }}>create-queue</button>
      <button onClick={async () => {
        if (!firstId) return;
        await queuesApiClient.updateQueue(Number(firstId), { doctorName: 'Dr Updated' });
      }}>update-first</button>
      <button onClick={async () => {
        if (!firstId) return;
        await queuesApiClient.deleteQueue(Number(firstId));
      }}>delete-first</button>
      <button onClick={onRemount}>remount</button>
      <div>remount-key: {remount}</div>
    </div>
  );
};

const Shell: React.FC = () => {
  const [key, setKey] = React.useState(0);
  return (
    <UIProvider>
      <AuthProvider>
        <QueueProvider key={key}>
          <Harness remount={key} onRemount={() => setKey(k => k + 1)} />
        </QueueProvider>
      </AuthProvider>
    </UIProvider>
  );
};

describe('Queues + MSW integration', () => {
  it('loads queues on login; create/update/delete via API and reflect after remount', async () => {
    render(<Shell />);

    // initial load
    await waitFor(() => {
      expect(screen.getByText(/queues-count: 2/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/first-doctor: Dr One/i)).toBeInTheDocument();

    // create
    await userEvent.click(screen.getByRole('button', { name: /create-queue/i }));
    await userEvent.click(screen.getByRole('button', { name: /remount/i }));
    await waitFor(() => {
      expect(screen.getByText(/queues-count: 3/i)).toBeInTheDocument();
    });

    // update first
    await userEvent.click(screen.getByRole('button', { name: /update-first/i }));
    await userEvent.click(screen.getByRole('button', { name: /remount/i }));
    await waitFor(() => {
      expect(screen.getByText(/first-doctor: Dr Updated/i)).toBeInTheDocument();
    });

    // delete first
    await userEvent.click(screen.getByRole('button', { name: /delete-first/i }));
    await userEvent.click(screen.getByRole('button', { name: /remount/i }));
    await waitFor(() => {
      expect(screen.getByText(/queues-count: 2/i)).toBeInTheDocument();
    });
  });
});
