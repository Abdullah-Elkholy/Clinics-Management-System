'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Queue, Patient, MessageTemplate, MessageCondition } from '../types';
import type { ModeratorWithStats } from '@/utils/moderatorAggregation';
import { groupQueuesByModerator } from '@/utils/moderatorAggregation';
import { messageApiClient, type TemplateDto, type ConditionDto } from '@/services/api/messageApiClient';
import { queuesApiClient, type QueueDto } from '@/services/api/queuesApiClient';
import { queueDtoToModel, templateDtoToModel, conditionDtoToModel } from '@/services/api/adapters';
import { useAuth } from '@/contexts/AuthContext';

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
  isLoadingTemplates: boolean;
  templateError: string | null;
}

const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser } = useAuth();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const [queuesError, setQueuesError] = useState<string | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPosition, setCurrentPosition] = useState(3);
  const [estimatedTimePerSession, setEstimatedTimePerSession] = useState(15);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [selectedMessageTemplateId, setSelectedMessageTemplateId] = useState('1');
  const [messageConditions, setMessageConditions] = useState<MessageCondition[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Load queues on mount (only if authenticated)
  useEffect(() => {
    // Don't load if user is not authenticated
    if (!currentUser) {
      setQueues([]);
      return;
    }

    const loadQueues = async () => {
      try {
        setQueuesLoading(true);
        setQueuesError(null);
        
        const response = await queuesApiClient.getQueues();
        
        if (response.items && response.items.length > 0) {
          const queuesData: Queue[] = response.items.map(queueDtoToModel);
          setQueues(queuesData);
        } else {
          setQueues([]);
        }
      } catch (error) {
        console.warn('Failed to load queues from API:', error);
        setQueuesError('Failed to load queues');
        setQueues([]);
      } finally {
        setQueuesLoading(false);
      }
    };

    loadQueues();
  }, [currentUser]);

  // Memoized list of moderators with aggregated stats
  const moderators = useMemo(
    () => groupQueuesByModerator(queues, messageTemplates, messageConditions),
    [queues, messageTemplates, messageConditions]
  );

  // Load templates from API when selected queue changes
  useEffect(() => {
    if (!selectedQueueId) return;

    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        
        // Fetch templates from API for the selected queue
        const templateResponse = await messageApiClient.getTemplates(Number(selectedQueueId));
        
        if (templateResponse.items && templateResponse.items.length > 0) {
          // Convert TemplateDto to MessageTemplate
          const templates: MessageTemplate[] = templateResponse.items.map((dto: TemplateDto) =>
            templateDtoToModel(dto, selectedQueueId)
          );
          setMessageTemplates(templates);
          if (templates.length > 0) {
            setSelectedMessageTemplateId(templates[0].id);
          }

          // Fetch conditions for this queue
          try {
            const conditionResponse = await messageApiClient.getConditions(Number(selectedQueueId));
            if (conditionResponse.items && conditionResponse.items.length > 0) {
              const conditions: MessageCondition[] = conditionResponse.items.map((dto: ConditionDto, idx: number) =>
                conditionDtoToModel(dto, idx)
              );
              setMessageConditions(conditions);
            } else {
              setMessageConditions([]);
            }
          } catch (condError) {
            console.warn('Failed to load conditions:', condError);
            setMessageConditions([]);
          }
        } else {
          setMessageTemplates([]);
          setMessageConditions([]);
        }
      } catch (error) {
        // On error, show message but don't revert to mock data for production safety
        console.warn('Failed to load templates from API:', error);
        setTemplateError('Unable to load templates');
        setMessageTemplates([]);
        setMessageConditions([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [selectedQueueId]);

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
        isLoadingTemplates,
        templateError,
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
