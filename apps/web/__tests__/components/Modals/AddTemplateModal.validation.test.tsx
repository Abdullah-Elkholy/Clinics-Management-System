import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const closeModalMock = jest.fn();
const getModalDataMock = jest.fn(() => ({ queueId: '1' }));
const addToastMock = jest.fn();
const addMessageTemplateMock = jest.fn();
const createTemplateApiMock = jest.fn().mockResolvedValue({});

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

describe('AddTemplateModal: validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires title and content; does not submit when missing', async () => {
    render(<AddTemplateModal />);

    // Leave fields empty and click submit
    fireEvent.click(screen.getByRole('button', { name: /إضافة القالب/i }));

    await waitFor(() => {
      expect(createTemplateApiMock).not.toHaveBeenCalled();
      expect(addMessageTemplateMock).not.toHaveBeenCalled();
      // Expect error messages tied to required fields to be present
      expect(screen.getAllByText(/مطلوب/i).length).toBeGreaterThan(0);
    });
  });

  it('rejects content exceeding 1000 characters (shows toast and prevents submit)', async () => {
    render(<AddTemplateModal />);

    const titleInput = screen.getByPlaceholderText('أدخل عنوان القالب');
  const contentInput = screen.getByPlaceholderText('أدخل محتوى الرسالة');

    // Valid title
    fireEvent.change(titleInput, { target: { value: 'عنوان صالح' } });
    // Oversized content (1001 chars)
    const longText = 'أ'.repeat(1001);
    fireEvent.change(contentInput, { target: { value: longText } });

    // Since typing beyond 1000 is blocked, expect a toast and no submission
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('الحد الأقصى 1000 حرف', 'error');
      expect(createTemplateApiMock).not.toHaveBeenCalled();
      expect(addMessageTemplateMock).not.toHaveBeenCalled();
    });
  });
});
