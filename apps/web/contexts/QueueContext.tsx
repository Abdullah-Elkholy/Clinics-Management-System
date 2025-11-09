'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Queue, Patient, MessageTemplate, MessageCondition } from '../types';
import type { ModeratorWithStats } from '@/utils/moderatorAggregation';
import { groupQueuesByModerator } from '@/utils/moderatorAggregation';
import { messageApiClient, type TemplateDto, type ConditionDto } from '@/services/api/messageApiClient';
import { queuesApiClient, type QueueDto } from '@/services/api/queuesApiClient';
import { queueDtoToModel, templateDtoToModel, conditionDtoToModel } from '@/services/api/adapters';
import { useAuth } from '@/contexts/AuthContext';
import { featureFlags, getCachedUseMockData } from '@/config/featureFlags';
import { getMockTemplates, getMockConditions } from '@/services/mock/mockData';
import { useToast } from '@/hooks/useToast';

interface QueueContextType {
  queues: Queue[];
  queuesLoading: boolean;
  queuesError: string | null;
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
  conditionsError: string | null;
  isMutatingTemplate: boolean;
  isMutatingCondition: boolean;
}

const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
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
  const [conditionsError, setConditionsError] = useState<string | null>(null);
  const [isMutatingTemplate, setIsMutatingTemplate] = useState(false);
  const [isMutatingCondition, setIsMutatingCondition] = useState(false);

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

        // The API can return either { items: QueueDto[] } or { data: QueueDto[] }
        const list = (response as any)?.items ?? (response as any)?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const queuesData: Queue[] = list.map((dto: any) => queueDtoToModel(dto as QueueDto));
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

    // Validate that selectedQueueId is a valid number
    const queueIdNum = Number(selectedQueueId);
    if (isNaN(queueIdNum)) {
      console.warn('Invalid queueId:', selectedQueueId);
      setMessageTemplates([]);
      setMessageConditions([]);
      return;
    }

    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        setConditionsError(null);

        let templateDtos: TemplateDto[] = [];
        let conditionDtos: ConditionDto[] = [];

        // Decide: use backend or mock
        const useMock = getCachedUseMockData();

        if (useMock) {
          // Use mock data directly
          templateDtos = getMockTemplates(queueIdNum);
          conditionDtos = getMockConditions(queueIdNum);
        } else {
          // Fetch templates from API for the selected queue
          try {
            const templateResponse = await messageApiClient.getTemplates(queueIdNum);
            templateDtos = templateResponse.items || [];
          } catch (error) {
            console.warn('Failed to load templates from API:', error);
            // Fall back to mock on error
            templateDtos = getMockTemplates(queueIdNum);
            if (!featureFlags.USE_MOCK_DATA) {
              setTemplateError('Unable to load templates. Using local data.');
            }
          }

          // Fetch conditions for this queue
          try {
            const conditionResponse = await messageApiClient.getConditions(queueIdNum);
            conditionDtos = conditionResponse.items || [];
          } catch (error) {
            console.warn('Failed to load conditions:', error);
            // Fall back to mock on error
            conditionDtos = getMockConditions(queueIdNum);
            if (!featureFlags.USE_MOCK_DATA) {
              setConditionsError('Unable to load conditions. Using local data.');
            }
          }
        }

        // Convert DTOs to models
        if (templateDtos.length > 0) {
          const templates: MessageTemplate[] = templateDtos.map((dto: TemplateDto) =>
            templateDtoToModel(dto, selectedQueueId)
          );
          setMessageTemplates(templates);
          if (templates.length > 0) {
            setSelectedMessageTemplateId(templates[0].id);
          }
        } else {
          setMessageTemplates([]);
        }

        if (conditionDtos.length > 0) {
          const conditions: MessageCondition[] = conditionDtos.map((dto: ConditionDto, idx: number) =>
            conditionDtoToModel(dto, idx)
          );
          setMessageConditions(conditions);
        } else {
          setMessageConditions([]);
        }
      } catch (error) {
        console.error('Unexpected error loading templates/conditions:', error);
        setTemplateError('An unexpected error occurred');
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

  const addMessageTemplate = useCallback(
    async (template: Omit<MessageTemplate, 'id'>) => {
      if (!selectedQueueId) return;

      const queueIdNum = Number(selectedQueueId);
      if (isNaN(queueIdNum)) {
        toast?.('ID فريق غير صحيح', 'error');
        return;
      }

      // Create optimistic template with temporary ID
      const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
      const optimisticTemplate: MessageTemplate = {
        ...template,
        id: tempId,
      };

      // Add optimistically
      setMessageTemplates((prev) => [...prev, optimisticTemplate]);
      setIsMutatingTemplate(true);

      try {
        // Call backend
        const dto = await messageApiClient.createTemplate({
          title: template.title,
          content: template.content,
          queueId: queueIdNum,
          isActive: true,
        });

        // Replace optimistic with real template
        const realTemplate = templateDtoToModel(dto, selectedQueueId);
        setMessageTemplates((prev) =>
          prev.map((t) => (t.id === tempId ? realTemplate : t))
        );

        toast?.('تم إنشاء القالب بنجاح', 'success');
      } catch (error) {
        // Remove optimistic template on error
        setMessageTemplates((prev) => prev.filter((t) => t.id !== tempId));
        const errorMsg = error instanceof Error ? error.message : 'فشل إنشاء القالب';
        toast?.(errorMsg, 'error');
        console.error('Failed to create template:', error);
      } finally {
        setIsMutatingTemplate(false);
      }
    },
    [selectedQueueId, toast]
  );

  const updateMessageTemplate = useCallback(
    async (id: string, templateUpdates: Partial<MessageTemplate>) => {
      if (!selectedQueueId) return;

      const queueIdNum = Number(selectedQueueId);
      if (isNaN(queueIdNum)) {
        toast?.('ID فريق غير صحيح', 'error');
        return;
      }

      // Store original for rollback
      const originalTemplates = messageTemplates;
      const templateToUpdate = messageTemplates.find((t) => t.id === id);
      if (!templateToUpdate) return;

      // Update optimistically
      setMessageTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...templateUpdates } : t))
      );
      setIsMutatingTemplate(true);

      try {
        // Try to parse ID as number (backend ID)
        const backendId = Number(id);
        if (isNaN(backendId)) {
          throw new Error('Invalid template ID');
        }

        // Call backend
        await messageApiClient.updateTemplate(backendId, {
          title: templateUpdates.title,
          content: templateUpdates.content,
          isActive: templateUpdates.isActive,
        });

        toast?.('تم تحديث القالب بنجاح', 'success');
      } catch (error) {
        // Rollback on error
        setMessageTemplates(originalTemplates);
        const errorMsg = error instanceof Error ? error.message : 'فشل تحديث القالب';
        toast?.(errorMsg, 'error');
        console.error('Failed to update template:', error);
      } finally {
        setIsMutatingTemplate(false);
      }
    },
    [selectedQueueId, messageTemplates, toast]
  );

  const deleteMessageTemplate = useCallback(
    async (id: string) => {
      if (!selectedQueueId) return;

      // Store original for rollback
      const originalTemplates = messageTemplates;

      // Remove optimistically
      setMessageTemplates((prev) => prev.filter((t) => t.id !== id));
      setIsMutatingTemplate(true);

      try {
        // Try to parse ID as number (backend ID)
        const backendId = Number(id);
        if (isNaN(backendId)) {
          throw new Error('Invalid template ID');
        }

        // Call backend
        await messageApiClient.deleteTemplate(backendId);

        toast?.('تم حذف القالب بنجاح', 'success');
      } catch (error) {
        // Restore on error
        setMessageTemplates(originalTemplates);
        const errorMsg = error instanceof Error ? error.message : 'فشل حذف القالب';
        toast?.(errorMsg, 'error');
        console.error('Failed to delete template:', error);
      } finally {
        setIsMutatingTemplate(false);
      }
    },
    [selectedQueueId, messageTemplates, toast]
  );

  const addMessageCondition = useCallback(
    async (condition: Omit<MessageCondition, 'id'>) => {
      if (!selectedQueueId) return;

      if (messageConditions.length >= 5) {
        toast?.('لا يمكن إضافة أكثر من 5 شروط', 'error');
        return;
      }

      // Create optimistic condition with temporary ID
      const tempId = `temp-${Math.random().toString(36).substr(2, 9)}`;
      const optimisticCondition: MessageCondition = {
        ...condition,
        id: tempId,
      };

      // Add optimistically
      setMessageConditions((prev) => [...prev, optimisticCondition]);
      setIsMutatingCondition(true);

      try {
        // Find the template this condition should be associated with
        const firstTemplate = messageTemplates[0];
        if (!firstTemplate) {
          throw new Error('لا يوجد قالب لربط الشرط به');
        }

        const templateBackendId = Number(firstTemplate.id);
        if (isNaN(templateBackendId)) {
          throw new Error('معرف القالب غير صحيح');
        }

        // Call backend
        const dto = await messageApiClient.createCondition({
          templateId: templateBackendId,
          operator: condition.operator,
          value: condition.value !== undefined ? String(condition.value) : undefined,
          minValue: condition.minValue !== undefined ? String(condition.minValue) : undefined,
          maxValue: condition.maxValue !== undefined ? String(condition.maxValue) : undefined,
        });

        // Replace optimistic with real condition
        const realCondition = conditionDtoToModel(dto, messageConditions.length);
        setMessageConditions((prev) =>
          prev.map((c) => (c.id === tempId ? realCondition : c))
        );

        toast?.('تم إضافة الشرط بنجاح', 'success');
      } catch (error) {
        // Remove optimistic condition on error
        setMessageConditions((prev) => prev.filter((c) => c.id !== tempId));
        const errorMsg = error instanceof Error ? error.message : 'فشل إضافة الشرط';
        toast?.(errorMsg, 'error');
        console.error('Failed to create condition:', error);
      } finally {
        setIsMutatingCondition(false);
      }
    },
    [selectedQueueId, messageTemplates, messageConditions.length, toast]
  );

  const removeMessageCondition = useCallback(
    async (id: string) => {
      // Store original for rollback
      const originalConditions = messageConditions;

      // Remove optimistically
      setMessageConditions((prev) => prev.filter((c) => c.id !== id));
      setIsMutatingCondition(true);

      try {
        // Try to parse ID as number (backend ID)
        const backendId = Number(id);
        if (isNaN(backendId)) {
          throw new Error('معرف الشرط غير صحيح');
        }

        // Call backend
        await messageApiClient.deleteCondition(backendId);

        toast?.('تم حذف الشرط بنجاح', 'success');
      } catch (error) {
        // Restore on error
        setMessageConditions(originalConditions);
        const errorMsg = error instanceof Error ? error.message : 'فشل حذف الشرط';
        toast?.(errorMsg, 'error');
        console.error('Failed to delete condition:', error);
      } finally {
        setIsMutatingCondition(false);
      }
    },
    [messageConditions, toast]
  );

  const updateMessageCondition = useCallback(
    async (id: string, conditionUpdates: Partial<MessageCondition>) => {
      // Store original for rollback
      const originalConditions = messageConditions;
      const conditionToUpdate = messageConditions.find((c) => c.id === id);
      if (!conditionToUpdate) return;

      // Update optimistically
      setMessageConditions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...conditionUpdates } : c))
      );
      setIsMutatingCondition(true);

      try {
        // Try to parse ID as number (backend ID)
        const backendId = Number(id);
        if (isNaN(backendId)) {
          throw new Error('معرف الشرط غير صحيح');
        }

        // Call backend
        await messageApiClient.updateCondition(backendId, {
          operator: conditionUpdates.operator,
          value: conditionUpdates.value !== undefined ? String(conditionUpdates.value) : undefined,
          minValue: conditionUpdates.minValue !== undefined ? String(conditionUpdates.minValue) : undefined,
          maxValue: conditionUpdates.maxValue !== undefined ? String(conditionUpdates.maxValue) : undefined,
        });

        toast?.('تم تحديث الشرط بنجاح', 'success');
      } catch (error) {
        // Rollback on error
        setMessageConditions(originalConditions);
        const errorMsg = error instanceof Error ? error.message : 'فشل تحديث الشرط';
        toast?.(errorMsg, 'error');
        console.error('Failed to update condition:', error);
      } finally {
        setIsMutatingCondition(false);
      }
    },
    [messageConditions, toast]
  );

  return (
    <QueueContext.Provider
      value={{
        queues,
        queuesLoading,
        queuesError,
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
        conditionsError,
        isMutatingTemplate,
        isMutatingCondition,
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
