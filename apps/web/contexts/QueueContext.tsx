'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Queue, Patient, MessageTemplate, MessageCondition } from '../types';
import { SAMPLE_QUEUES } from '../constants';
import { MOCK_MESSAGE_TEMPLATES } from '@/constants/mockData';
import type { ModeratorWithStats } from '@/utils/moderatorAggregation';
import { groupQueuesByModerator } from '@/utils/moderatorAggregation';

interface QueueContextType {
  queues: Queue[];
  addQueue: (queue: Omit<Queue, 'id'>) => void;
  updateQueue: (id: string, queue: Partial<Queue>) => void;
  deleteQueue: (id: string) => void;
  selectedQueueId: string | null;
  setSelectedQueueId: (id: string | null) => void;
  patients: Patient[];
  addPatient: (patient: Omit<Patient, 'id'>) => void;
  updatePatient: (id: number | string, patient: Partial<Patient>) => void;
  deletePatient: (id: number | string) => void;
  reorderPatients: (patients: Patient[]) => void;
  togglePatientSelection: (id: number | string) => void;
  selectAllPatients: () => void;
  clearPatientSelection: () => void;
  currentPosition: number;
  setCurrentPosition: (position: number) => void;
  estimatedTimePerSession: number;
  setEstimatedTimePerSession: (time: number) => void;
  messageTemplates: MessageTemplate[];
  addMessageTemplate: (template: Omit<MessageTemplate, 'id'>) => void;
  updateMessageTemplate: (id: string, template: Partial<MessageTemplate>) => void;
  deleteMessageTemplate: (id: string) => void;
  selectedMessageTemplateId: string;
  setSelectedMessageTemplateId: (id: string) => void;
  messageConditions: MessageCondition[];
  addMessageCondition: (condition: Omit<MessageCondition, 'id'>) => void;
  removeMessageCondition: (id: string) => void;
  updateMessageCondition: (id: string, condition: Partial<MessageCondition>) => void;
  moderators: ModeratorWithStats[];
}

const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queues, setQueues] = useState<Queue[]>(SAMPLE_QUEUES);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPosition, setCurrentPosition] = useState(3);
  const [estimatedTimePerSession, setEstimatedTimePerSession] = useState(15);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(MOCK_MESSAGE_TEMPLATES as MessageTemplate[]);
  const [selectedMessageTemplateId, setSelectedMessageTemplateId] = useState('1');
  const [messageConditions, setMessageConditions] = useState<MessageCondition[]>([]);

  // Memoized list of moderators with aggregated stats
  const moderators = useMemo(
    () => groupQueuesByModerator(queues, messageTemplates, messageConditions),
    [queues, messageTemplates, messageConditions]
  );

  // Helper function to generate GUID-like IDs
  const generateGUID = (prefix: string = ''): string => {
    const base = `${prefix}${prefix ? '-' : ''}uuid-${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
    return base;
  };

  const addQueue = useCallback((queue: Omit<Queue, 'id'>) => {
    const newQueue: Queue = {
      ...queue,
      id: generateGUID('queue'),
    };
    setQueues((prev) => [...prev, newQueue]);
  }, []);

  const updateQueue = useCallback((id: string, queueUpdates: Partial<Queue>) => {
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...queueUpdates } : q))
    );
  }, []);

  const deleteQueue = useCallback((id: string) => {
    setQueues((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const addPatient = useCallback((patient: Omit<Patient, 'id'>) => {
    const newPatient: Patient = {
      ...patient,
      id: generateGUID(),
    };
    setPatients((prev) => [...prev, newPatient]);
  }, []);

  const updatePatient = useCallback((id: number | string, patientUpdates: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patientUpdates } : p))
    );
  }, []);

  const deletePatient = useCallback((id: number | string) => {
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const reorderPatients = useCallback((newPatients: Patient[]) => {
    setPatients(newPatients);
  }, []);

  const togglePatientSelection = useCallback((id: number | string) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const selectAllPatients = useCallback(() => {
    setPatients((prev) => prev.map((p) => ({ ...p, selected: true })));
  }, []);

  const clearPatientSelection = useCallback(() => {
    setPatients((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  const addMessageTemplate = useCallback((template: Omit<MessageTemplate, 'id'>) => {
    const newTemplate: MessageTemplate = {
      ...template,
      id: generateGUID('template'),
    };
    setMessageTemplates((prev) => [...prev, newTemplate]);
  }, []);

  const updateMessageTemplate = useCallback((id: string, templateUpdates: Partial<MessageTemplate>) => {
    setMessageTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...templateUpdates } : t))
    );
  }, []);

  const deleteMessageTemplate = useCallback((id: string) => {
    setMessageTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addMessageCondition = useCallback((condition: Omit<MessageCondition, 'id'>) => {
    if (messageConditions.length >= 5) return;
    const newCondition: MessageCondition = {
      ...condition,
      id: generateGUID('condition'),
    };
    setMessageConditions((prev) => [...prev, newCondition]);
  }, [messageConditions.length]);

  const removeMessageCondition = useCallback((id: string) => {
    setMessageConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateMessageCondition = useCallback((id: string, conditionUpdates: Partial<MessageCondition>) => {
    setMessageConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...conditionUpdates } : c))
    );
  }, []);

  return (
    <QueueContext.Provider
      value={{
        queues,
        addQueue,
        updateQueue,
        deleteQueue,
        selectedQueueId,
        setSelectedQueueId,
        patients,
        addPatient,
        updatePatient,
        deletePatient,
        reorderPatients,
        togglePatientSelection,
        selectAllPatients,
        clearPatientSelection,
        currentPosition,
        setCurrentPosition,
        estimatedTimePerSession,
        setEstimatedTimePerSession,
        messageTemplates,
        addMessageTemplate,
        updateMessageTemplate,
        deleteMessageTemplate,
        selectedMessageTemplateId,
        setSelectedMessageTemplateId,
        messageConditions,
        addMessageCondition,
        removeMessageCondition,
        updateMessageCondition,
        moderators,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within QueueProvider');
  }
  return context;
};
