import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { MessageTemplate, MessageCondition } from '@/types';

const closeModalMock = jest.fn();
const getModalDataMock = jest.fn(() => ({ templateId: '101' }));
const addToastMock = jest.fn();
const updateMessageTemplateMock = jest.fn();

// Stable data references to avoid infinite effects triggered by new arrays
const templates: MessageTemplate[] = [
  {
    id: '101',
    queueId: '1',
    title: 'عنوان قديم',
    content: 'محتوى قديم',
    isDeleted: false,
    variables: [],
    createdAt: new Date(),
    createdBy: 'user',
  },
];

const conditions: MessageCondition[] = [
  {
    id: '201',
    queueId: '1',
    templateId: '101',
    operator: 'UNCONDITIONED',
    enabled: true,
    priority: 0,
    template: '',
    createdAt: new Date(),
  },
];

const queueContextValue = {
  selectedQueueId: '1',
  updateMessageTemplate: updateMessageTemplateMock,
  messageTemplates: templates,
  addMessageCondition: jest.fn(),
  updateMessageCondition: jest.fn(),
  messageConditions: conditions,
};

jest.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    openModals: new Set(['editTemplate']),
    closeModal: closeModalMock,
    getModalData: getModalDataMock,
  }),
}));

jest.mock('@/contexts/UIContext', () => ({
  useUI: () => ({ addToast: addToastMock }),
}));

jest.mock('@/contexts/QueueContext', () => ({
  useQueue: () => queueContextValue,
}));

import EditTemplateModal from '@/components/Modals/EditTemplateModal';

describe('EditTemplateModal: submit flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates template via context and closes modal', async () => {
    render(<EditTemplateModal />);

    // Existing values should be loaded
  const titleInput = screen.getByPlaceholderText('أدخل عنوان القالب') as HTMLInputElement;
  const contentInput = screen.getByPlaceholderText('أدخل محتوى الرسالة') as HTMLTextAreaElement;

    expect(titleInput.value).toBe('عنوان قديم');
    expect(contentInput.value).toBe('محتوى قديم');

    // Change values
    fireEvent.change(titleInput, { target: { value: 'عنوان جديد' } });
    fireEvent.change(contentInput, { target: { value: 'محتوى جديد' } });

    const submitBtn = screen.getByRole('button', { name: /حفظ التغييرات/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateMessageTemplateMock).toHaveBeenCalledWith('101', expect.objectContaining({
        title: 'عنوان جديد',
        content: 'محتوى جديد',
      }));
      expect(addToastMock).toHaveBeenCalled();
      expect(closeModalMock).toHaveBeenCalledWith('editTemplate');
    });
  });
});
