import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const closeModalMock = jest.fn();
const getModalDataMock = jest.fn(() => ({ queueId: '1', queueName: 'طابور تجريبي' }));
const addToastMock = jest.fn();
const refreshQueueDataMock = jest.fn().mockResolvedValue(undefined);
const updateMessageConditionMock = jest.fn();

const setTemplateAsDefaultMock = jest.fn().mockResolvedValue({});
const updateConditionApiMock = jest.fn().mockResolvedValue({});

jest.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    openModals: new Set(['manageConditions']),
    closeModal: closeModalMock,
    getModalData: getModalDataMock,
  }),
}));

jest.mock('@/contexts/UIContext', () => ({
  useUI: () => ({ addToast: addToastMock }),
}));

jest.mock('@/contexts/QueueContext', () => ({
  useQueue: () => ({
    queues: [{ id: '1', doctorName: 'د. أحمد' }],
    selectedQueueId: '1',
    messageTemplates: [
      { id: '101', queueId: '1', title: 'قالب نشط', content: 'x', isActive: true, variables: [], createdAt: new Date(), createdBy: 'u', condition: { operator: 'EQUAL' } as any },
      { id: '102', queueId: '1', title: 'قالب بدون شرط', content: 'y', isActive: true, variables: [], createdAt: new Date(), createdBy: 'u', condition: { operator: 'UNCONDITIONED' } as any },
    ],
    messageConditions: [
      { id: '201', queueId: '1', templateId: '101', operator: 'EQUAL', value: 1, enabled: true, priority: 0, createdAt: new Date() },
      { id: '202', queueId: '1', templateId: '102', operator: 'UNCONDITIONED', enabled: true, priority: 0, createdAt: new Date() },
    ],
    updateMessageCondition: updateMessageConditionMock,
    refreshQueueData: refreshQueueDataMock,
  }),
}));

jest.mock('@/services/api/messageApiClient', () => ({
  messageApiClient: {
    setTemplateAsDefault: (id: number) => setTemplateAsDefaultMock(id),
    updateCondition: (id: number, dto: any) => updateConditionApiMock(id, dto),
  },
}));

import ManageConditionsModal from '@/components/Modals/ManageConditionsModal';

describe('ManageConditionsModal: refetch & close flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clicking Set as Default triggers API and refresh', async () => {
    render(<ManageConditionsModal />);

    const setDefaultButtons = screen.getAllByRole('button', { name: /تعيين كافتراضي/i });
    fireEvent.click(setDefaultButtons[0]);

    await waitFor(() => {
      expect(setTemplateAsDefaultMock).toHaveBeenCalled();
      expect(refreshQueueDataMock).toHaveBeenCalledWith('1');
      expect(addToastMock).toHaveBeenCalled();
    });
  });

  it('clicking بدون شرط on an active template updates condition and refreshes', async () => {
    render(<ManageConditionsModal />);

    const unconditionButtons = screen.getAllByRole('button', { name: /بدون شرط/i });
    fireEvent.click(unconditionButtons[0]);

    await waitFor(() => {
      expect(updateConditionApiMock).toHaveBeenCalled();
      expect(updateMessageConditionMock).toHaveBeenCalled();
      expect(refreshQueueDataMock).toHaveBeenCalledWith('1');
    });
  });

  it('closing the modal triggers refresh and closeModal', async () => {
    render(<ManageConditionsModal />);

    const doneBtn = screen.getByRole('button', { name: /^تم$/ });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(refreshQueueDataMock).toHaveBeenCalledWith('1');
      expect(closeModalMock).toHaveBeenCalledWith('manageConditions');
    });
  });
});
