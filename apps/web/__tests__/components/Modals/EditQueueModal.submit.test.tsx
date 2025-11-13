import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mocks captured for assertions
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

describe('EditQueueModal: submit flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits valid form, updates API and context, and closes modal', async () => {
    render(<EditQueueModal />);

    // Fill doctor name
  const nameInput = screen.getByPlaceholderText('أدخل اسم الطبيب');
  fireEvent.change(nameInput, { target: { value: 'خالد سالم' } });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /حفظ التغييرات/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
  expect(updateQueueApiMock).toHaveBeenCalledWith(1, { doctorName: 'خالد سالم' });
  expect(updateQueueMock).toHaveBeenCalledWith('1', { doctorName: 'خالد سالم' });
      expect(addToastMock).toHaveBeenCalled();
      expect(closeModalMock).toHaveBeenCalledWith('editQueue');
    });
  });
});
