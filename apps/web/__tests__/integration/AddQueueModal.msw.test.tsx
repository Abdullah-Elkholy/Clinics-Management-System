import { useEffect, type FC } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIProvider, useUI } from '@/contexts/UIContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ModalProvider, useModal } from '@/contexts/ModalContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';
import AddQueueModal from '@/components/Modals/AddQueueModal';

// Harness to wire providers and expose simple controls/state for assertions
const Harness: FC = () => {
  const { login } = useAuth();
  const { openModal } = useModal();
  const { queues } = useQueue();
  const { toasts } = useUI();

  useEffect(() => {
    (async () => {
      await login('tester', 'password');
    })();
  }, [login]);

  return (
    <div>
      <div>queues-count: {queues.length}</div>
      <div>toasts-count: {toasts.length}</div>
      <button onClick={() => openModal('addQueue')}>open-add-queue</button>
    </div>
  );
};

const AppTree: FC = () => (
  <UIProvider>
    <AuthProvider>
      <ModalProvider>
        <QueueProvider>
          <Harness />
          <AddQueueModal />
        </QueueProvider>
      </ModalProvider>
    </AuthProvider>
  </UIProvider>
);

describe('AddQueueModal + MSW integration', () => {
  it('validates doctor name and prevents submit when invalid', async () => {
    render(<AppTree />);

    // Wait for initial queues to load (MSW returns 2)
    await waitFor(() => expect(screen.getByText(/queues-count: 2/i)).toBeInTheDocument());

    // Open modal
    await userEvent.click(screen.getByRole('button', { name: /open-add-queue/i }));

    // Enter invalid name (too short after normalization)
    const input = await screen.findByPlaceholderText('أدخل اسم الطبيب');
    await userEvent.clear(input);
    await userEvent.type(input, 'د. أ'); // becomes 1 char after removing prefix

    // Try to submit
    await userEvent.click(screen.getByRole('button', { name: /إضافة/i }));

  // Expect validation error(s) and no queue added
  const errs = await screen.findAllByText(/اسم الطبيب يجب أن يكون 3 أحرف على الأقل/i);
  expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/queues-count: 2/i)).toBeInTheDocument();
  });

  it('creates a queue via API and closes modal with success toast', async () => {
    render(<AppTree />);

    // Wait for initial queues
    await waitFor(() => expect(screen.getByText(/queues-count: 2/i)).toBeInTheDocument());

    // Open modal
    await userEvent.click(screen.getByRole('button', { name: /open-add-queue/i }));

    // Fill valid doctor name (Arabic with allowed prefix)
    const input = await screen.findByPlaceholderText('أدخل اسم الطبيب');
    await userEvent.clear(input);
    await userEvent.type(input, 'د. أحمد علي');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /إضافة/i }));

    // Wait for modal to close (input disappears) and toast added; queues-count increments by 1 (local + API-backed create)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('أدخل اسم الطبيب')).not.toBeInTheDocument();
      expect(screen.getByText(/queues-count: 3/i)).toBeInTheDocument();
      // We also expose toasts-count to ensure a toast was pushed
      expect(screen.getByText(/toasts-count: 1/i)).toBeInTheDocument();
    });
  });
});
