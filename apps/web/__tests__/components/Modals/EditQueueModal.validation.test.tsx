import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const closeModalMock = jest.fn();
const getModalDataMock = jest.fn(() => ({ queueId: '1' }));
const addToastMock = jest.fn();
const updateQueueMock = jest.fn();
const updateQueueApiMock = jest.fn().mockResolvedValue({});

jest.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    openModals: new Set(['editQueue']),
    closeModal: closeModalMock,
    getModalData: getModalDataMock,
  }),
}));

jest.mock('@/contexts/UIContext', () => ({
  useUI: () => ({ addToast: addToastMock }),
}));

jest.mock('@/contexts/QueueContext', () => ({
  useQueue: () => ({ updateQueue: updateQueueMock }),
}));

jest.mock('@/services/api/queuesApiClient', () => ({
  queuesApiClient: { updateQueue: updateQueueApiMock },
}));

import EditQueueModal from '@/components/Modals/EditQueueModal';

describe('EditQueueModal: validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows Arabic doctor prefix "د." and submits successfully', async () => {
    render(<EditQueueModal />);

    const nameInput = screen.getByPlaceholderText('أدخل اسم الطبيب');
    fireEvent.change(nameInput, { target: { value: 'د. خالد سالم' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /حفظ التغييرات/i }));

    await waitFor(() => {
      expect(updateQueueApiMock).toHaveBeenCalled();
      expect(updateQueueMock).toHaveBeenCalled();
      expect(closeModalMock).toHaveBeenCalled();
    });
  });

  it('rejects invalid doctor name containing symbols or numbers', async () => {
    render(<EditQueueModal />);

    const nameInput = screen.getByPlaceholderText('أدخل اسم الطبيب');
    fireEvent.change(nameInput, { target: { value: 'خالد! 123' } });

    // Try submit
    fireEvent.click(screen.getByRole('button', { name: /حفظ التغييرات/i }));

    // Expect validation message to render and no API calls
    await waitFor(() => {
      expect(screen.getByText(/أحرف غير صالحة/i)).toBeInTheDocument();
      expect(updateQueueApiMock).not.toHaveBeenCalled();
      expect(updateQueueMock).not.toHaveBeenCalled();
      expect(closeModalMock).not.toHaveBeenCalled();
    });
  });
});
