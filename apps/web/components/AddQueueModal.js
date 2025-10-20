import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import { useI18n } from '../lib/i18n';

function AddQueueModal({ open, onClose, onAdd }) {
  const i18n = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    onAdd(name, description);
    setName('');
    setDescription('');
  };

  return (
    <ModalWrapper
      open={open}
      onClose={onClose}
      title={i18n.t('dashboard.queues.add.title', 'إضافة طابور جديد')}
      actions={[
        {
          label: i18n.t('modals.actions.cancel', 'إلغاء'),
          onClick: onClose,
          variant: 'secondary',
        },
        {
          label: i18n.t('modals.actions.add', 'إضافة'),
          onClick: handleAdd,
          variant: 'primary',
        },
      ]}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="queue-name" className="block text-sm font-medium text-gray-700">
            {i18n.t('dashboard.queues.add.name_label', 'اسم الطابور')}
          </label>
          <input
            type="text"
            id="queue-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="queue-description" className="block text-sm font-medium text-gray-700">
            {i18n.t('dashboard.queues.add.description_label', 'الوصف')}
          </label>
          <textarea
            id="queue-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>
    </ModalWrapper>
  );
}

export default AddQueueModal;
