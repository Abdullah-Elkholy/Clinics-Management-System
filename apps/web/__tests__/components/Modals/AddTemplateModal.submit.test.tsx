import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const closeModalMock = jest.fn();
const getModalDataMock = jest.fn(() => ({ queueId: '1' }));
const addToastMock = jest.fn();
const addMessageTemplateMock = jest.fn();
const createTemplateApiMock = jest.fn().mockResolvedValue({
  title: 'عنوان جديد',
  content: 'محتوى جديد',
  queueId: 1,
  isActive: true,
  createdAt: new Date('2025-01-01').toISOString(),
});

jest.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    openModals: new Set(['addTemplate']),
    closeModal: closeModalMock,
    getModalData: getModalDataMock,
  }),
}));

jest.mock('@/contexts/UIContext', () => ({
  useUI: () => ({ addToast: addToastMock }),
}));

jest.mock('@/contexts/QueueContext', () => ({
  useQueue: () => ({
    selectedQueueId: '1',
    addMessageTemplate: addMessageTemplateMock,
    messageTemplates: [],
    addMessageCondition: jest.fn(),
    messageConditions: [],
  }),
}));

jest.mock('@/services/api/messageApiClient', () => ({
  messageApiClient: { createTemplate: createTemplateApiMock },
}));

import AddTemplateModal from '@/components/Modals/AddTemplateModal';

describe('AddTemplateModal: submit flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates new template, updates context, and closes modal', async () => {
    render(<AddTemplateModal />);

  fireEvent.change(screen.getByPlaceholderText('أدخل عنوان القالب'), { target: { value: 'عنوان جديد' } });
  fireEvent.change(screen.getByPlaceholderText('أدخل محتوى الرسالة'), { target: { value: 'محتوى جديد' } });

    const submitBtn = screen.getByRole('button', { name: /إضافة القالب/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTemplateApiMock).toHaveBeenCalledWith({
        title: 'عنوان جديد',
        content: 'محتوى جديد',
        queueId: 1,
        isActive: true,
      });
      expect(addMessageTemplateMock).toHaveBeenCalled();
      expect(addToastMock).toHaveBeenCalled();
      expect(closeModalMock).toHaveBeenCalledWith('addTemplate');
    });
  });
});
