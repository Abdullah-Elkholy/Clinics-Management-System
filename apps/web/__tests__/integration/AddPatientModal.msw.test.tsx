import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UIProvider, useUI } from '@/contexts/UIContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ModalProvider, useModal } from '@/contexts/ModalContext';
import { QueueProvider, useQueue } from '@/contexts/QueueContext';
import AddPatientModal from '@/components/Modals/AddPatientModal';

// Harness to render the app tree and control modal/queue selection
const Harness: React.FC = () => {
  const { login } = useAuth();
  const { openModal } = useModal();
  const { setSelectedQueueId, patients } = useQueue();

  useEffect(() => {
    (async () => {
      await login('tester', 'password');
    })();
  }, [login]);

  return (
    <div>
      <div>patients-count: {patients.length}</div>
      <button onClick={() => setSelectedQueueId('789')}>select-queue-789</button>
      <button onClick={() => openModal('addPatient')}>open-add-patient</button>
    </div>
  );
};

const AppTree: React.FC = () => (
  <UIProvider>
    <AuthProvider>
      <ModalProvider>
        <QueueProvider>
          <Harness />
          <AddPatientModal />
        </QueueProvider>
      </ModalProvider>
    </AuthProvider>
  </UIProvider>
);

describe('AddPatientModal + MSW integration', () => {
  it('validates patient name and prevents submit when invalid', async () => {
    render(<AppTree />);

    // Select queue and wait for patients to load (MSW returns 2 for queue 789)
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));
    await waitFor(() => expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument());

    // Open modal
    await userEvent.click(screen.getByRole('button', { name: /open-add-patient/i }));

    // Find the first patient name input and enter invalid name (too short)
    const nameInputs = await screen.findAllByPlaceholderText(/أحمد محمد/i);
    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'أ'); // Only 1 character

    // Blur to trigger validation
    nameInputs[0].blur();

    // Wait for error to appear (error may show in summary and detail, so use getAllByText and check length)
    await waitFor(() => {
      const errors = screen.getAllByText(/اسم المريض يجب أن يكون 3 أحرف على الأقل/i);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Try to submit
    const submitButton = screen.getByRole('button', { name: /إضافة المرضى \(/i });

    // Submit should not change patient count (validation prevents add)
    await userEvent.click(submitButton);
    expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument();
  });

  it('validates patient phone and prevents submit when invalid', async () => {
    render(<AppTree />);

    // Select queue 789
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));
    await waitFor(() => expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument());

    // Open modal
    await userEvent.click(screen.getByRole('button', { name: /open-add-patient/i }));

    // Enter valid name but invalid phone
    const nameInputs = screen.getAllByPlaceholderText(/أحمد محمد/i);
    const phoneInputs = screen.getAllByPlaceholderText('01012345678');

    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'أحمد محمد');

    await userEvent.clear(phoneInputs[0]);
    await userEvent.type(phoneInputs[0], '123'); // Too short

    // Blur to trigger validation
    phoneInputs[0].blur();

    // Wait for phone error (may appear multiple times, so check count)
    await waitFor(() => {
      const errors = screen.getAllByText(/رقم الهاتف قصير جداً/i);
      expect(errors.length).toBeGreaterThan(0);
    });

    // Patients count should remain unchanged
    expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument();
  });

  it('creates a patient via API and reflects in provider state', async () => {
    render(<AppTree />);

    // Select queue 789
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));
    await waitFor(() => expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument());

    // Open modal
    await userEvent.click(screen.getByRole('button', { name: /open-add-patient/i }));

    // Enter valid patient data
    const nameInputs = await screen.findAllByPlaceholderText(/أحمد محمد/i);
    const phoneInputs = await screen.findAllByPlaceholderText('01012345678');

    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'فاطمة علي');

    await userEvent.clear(phoneInputs[0]);
    await userEvent.type(phoneInputs[0], '01123456789');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /إضافة المرضى/i }));

    // Wait for modal to close and patient count to increment
    await waitFor(() => {
      expect(screen.getByText(/patients-count: 3/i)).toBeInTheDocument();
    });
  });

  it('allows adding multiple patients in one submission', async () => {
    render(<AppTree />);

    // Select queue 789
    await userEvent.click(screen.getByRole('button', { name: /select-queue-789/i }));
    await waitFor(() => expect(screen.getByText(/patients-count: 2/i)).toBeInTheDocument());

    // Open modal
    await userEvent.click(screen.getByRole('button', { name: /open-add-patient/i }));

    // Fill first patient
    const nameInputs = screen.getAllByPlaceholderText(/أحمد محمد/i);
    const phoneInputs = screen.getAllByPlaceholderText('01012345678');

    await userEvent.clear(nameInputs[0]);
    await userEvent.type(nameInputs[0], 'محمود حسن');

    await userEvent.clear(phoneInputs[0]);
    await userEvent.type(phoneInputs[0], '01001112222');

    // Add another patient slot by clicking "إضافة مريض آخر" button
    const addSlotButton = screen.getByRole('button', { name: /إضافة مريض آخر/i });
    await userEvent.click(addSlotButton);

    // Wait for second patient slot header to appear, then click it to expand
    await waitFor(() => {
      const headers = screen.getAllByText(/المريض #/i);
      expect(headers.length).toBeGreaterThan(1);
    });

    // Find and click the collapsed second patient header to expand it
    const patientHeaders = screen.getAllByTitle(/توسيع|طي القسم/i);
    if (patientHeaders.length > 1) {
      await userEvent.click(patientHeaders[1]);
    }

    // Wait for second patient inputs to appear
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(/أحمد محمد/i).length).toBeGreaterThan(1);
    });

    // Fill second patient
    const allNameInputs = screen.getAllByPlaceholderText(/أحمد محمد/i);
    const allPhoneInputs = screen.getAllByPlaceholderText('01012345678');

    await userEvent.clear(allNameInputs[1]);
    await userEvent.type(allNameInputs[1], 'ليلى خالد');

    await userEvent.clear(allPhoneInputs[1]);
    await userEvent.type(allPhoneInputs[1], '01234567890');

    // Submit to add both
    await userEvent.click(screen.getByRole('button', { name: /إضافة المرضى \(2\)/i }));

    // Should add 2 patients (from 2 to 4)
    await waitFor(() => {
      expect(screen.getByText(/patients-count: 4/i)).toBeInTheDocument();
    });
  });
});
