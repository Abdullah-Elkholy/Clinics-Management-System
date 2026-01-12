'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Queue, Patient, MessageTemplate, MessageCondition } from '../types';
import type { ModeratorWithStats } from '@/utils/moderatorAggregation';
import { groupQueuesByModerator } from '@/utils/moderatorAggregation';
import { messageApiClient, type TemplateDto, type ConditionDto } from '@/services/api/messageApiClient';
import { queuesApiClient, type QueueDto } from '@/services/api/queuesApiClient';
import { patientsApiClient, type PatientDto } from '@/services/api/patientsApiClient';
import { queueDtoToModel, templateDtoToModel, conditionDtoToModel } from '@/services/api/adapters';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { useUI } from '@/contexts/UIContext';
import { useUserManagement } from '@/hooks/useUserManagement';
import logger from '@/utils/logger';

interface QueueContextType {
  queues: Queue[];
  queuesLoading: boolean;
  queuesError: string | null;
  addQueue: (queue: Omit<Queue, 'id'>) => void;
  updateQueue: (id: string, queue: Partial<Queue>) => void;
  deleteQueue: (id: string) => void;
  refreshQueues: () => Promise<void>;
  selectedQueueId: string | null;
  setSelectedQueueId: (id: string | null) => void;
  patients: Patient[];
  addPatient: (patient: Omit<Patient, 'id'>) => void;
  updatePatient: (id: number | string, patient: Partial<Patient>) => void;
  deletePatient: (id: number | string) => void;
  reorderPatients: (patients: Patient[]) => void;
  refreshPatients: (queueId?: string) => Promise<void>;
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
  setMessageTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  selectedMessageTemplateId: string;
  setSelectedMessageTemplateId: (id: string) => void;
  messageConditions: MessageCondition[];
  addMessageCondition: (condition: Omit<MessageCondition, 'id'>) => void;
  removeMessageCondition: (id: string) => void;
  updateMessageCondition: (id: string, condition: Partial<MessageCondition>) => void;
  setMessageConditions: React.Dispatch<React.SetStateAction<MessageCondition[]>>;
  refreshQueueData: (queueId: string) => Promise<void>;  // NEW: Reload templates and conditions from backend
  moderators: ModeratorWithStats[];
  isLoadingTemplates: boolean;
  templateError: string | null;
  conditionsError: string | null;
  isMutatingTemplate: boolean;
  isMutatingCondition: boolean;
}

export const QueueContext = createContext<QueueContextType | null>(null);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  // Use UIContext's selectedQueueId to keep them in sync with URL
  const { selectedQueueId, setSelectedQueueId } = useUI();
  // Get real moderator data from user management
  const [userManagementState, userManagementActions] = useUserManagement();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const [queuesError, setQueuesError] = useState<string | null>(null);
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

  // Load queues and moderators on mount (only if authenticated)
  useEffect(() => {
    // Don't load if user is not authenticated
    if (!currentUser) {
      setQueues([]);
      return;
    }

    refreshQueues();
    // Fetch moderators to ensure real data is available for aggregation
    userManagementActions.fetchModerators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]); // Only depend on user ID to avoid unnecessary re-fetches

  // Public: refresh queues list from backend
  const refreshQueues = useCallback(async () => {
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
      logger.warn('Failed to load queues from API:', error);
      setQueuesError('فشل تحميل قوائم الانتظار. تأكد من اتصالك بالخادم');
      setQueues([]);
    } finally {
      setQueuesLoading(false);
    }
  }, []);

  // Memoized list of moderators with aggregated stats
  // Use real moderator data from backend instead of mock data
  const moderators = useMemo(
    () => groupQueuesByModerator(queues, messageTemplates, messageConditions, userManagementState.moderators),
    [queues, messageTemplates, messageConditions, userManagementState.moderators]
  );

  // Load patients from API when selected queue changes
  useEffect(() => {
    if (!selectedQueueId) {
      setPatients([]);
      return;
    }

    const queueIdNum = Number(selectedQueueId);
    if (isNaN(queueIdNum)) {
      logger.warn('Invalid queueId:', selectedQueueId);
      setPatients([]);
      return;
    }

    refreshPatients(selectedQueueId);
  }, [selectedQueueId]);

  // Public: refresh patients for a queue (defaults to selected queue)
  const refreshPatients = useCallback(async (queueId?: string) => {
    const qid = queueId ?? selectedQueueId;
    if (!qid) {
      setPatients([]);
      return;
    }
    const queueIdNum = Number(qid);
    if (isNaN(queueIdNum)) {
      logger.warn('Invalid queueId:', qid);
      setPatients([]);
      return;
    }
    try {
      const response = await patientsApiClient.getPatients(queueIdNum);
      const patientDtos = response.items || [];
      const patientsData: Patient[] = patientDtos.map((dto: PatientDto) => {
        // Parse country code and phone from E.164 format (e.g., "+20118542431")
        const phoneNumber = dto.phoneNumber || '';
        // Use countryCode from DTO if available, otherwise extract from phone number
        let countryCode = dto.countryCode || '+20';
        let phone = phoneNumber;
        
        // If phone number is in E.164 format (starts with +), extract country code and phone
        if (phoneNumber.startsWith('+')) {
          const countryCodeDigits = countryCode.replace(/[^\d]/g, '');
          // If phone starts with the country code, remove it
          if (phoneNumber.startsWith(`+${countryCodeDigits}`)) {
            phone = phoneNumber.substring(countryCodeDigits.length + 1);
            // Remove leading zero for countries that require it (like Egypt +20)
            if (countryCodeDigits === '20' && phone.startsWith('0')) {
              phone = phone.substring(1);
            }
          } else {
            // Try to extract country code from phone number
        const match = phoneNumber.match(/^\+(\d{1,3})(.*)$/);
            if (match) {
              countryCode = `+${match[1]}`;
              phone = match[2];
              // Remove leading zero for Egypt
              if (match[1] === '20' && phone.startsWith('0')) {
                phone = phone.substring(1);
              }
            }
          }
        } else {
          // Phone doesn't have country code prefix, use the one from DTO
          // Remove leading zero if present for countries that require it
          if (countryCode === '+20' && phone.startsWith('0')) {
            phone = phone.substring(1);
          }
        }

        return {
          id: dto.id.toString(),
          queueId: queueIdNum.toString(),
          name: dto.fullName,
          phone: phone,
          countryCode: countryCode,
          isValidWhatsAppNumber: dto.isValidWhatsAppNumber, // CRITICAL: Include database validation status
          position: dto.position,
          status: dto.status,
          selected: false,
        };
      });
      setPatients(patientsData);
    } catch (error) {
      logger.warn('Failed to load patients:', error);
      setPatients([]);
    }
  }, [selectedQueueId]);

  // Load templates and conditions from API when selected queue changes
  useEffect(() => {
    if (!selectedQueueId) return;

    // Validate that selectedQueueId is a valid number
    const queueIdNum = Number(selectedQueueId);
    if (isNaN(queueIdNum)) {
      logger.warn('Invalid queueId:', selectedQueueId);
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

        // Fetch templates from API for the selected queue
        try {
          const templateResponse = await messageApiClient.getTemplates(queueIdNum);
          templateDtos = templateResponse.items || [];
        } catch (error) {
          logger.warn('Failed to load templates from API:', error);
          setTemplateError('Unable to load templates');
        }

        // Fetch conditions for this queue
        try {
          const conditionResponse = await messageApiClient.getConditions(queueIdNum);
          conditionDtos = conditionResponse.items || [];
        } catch (error) {
          logger.warn('Failed to load conditions:', error);
          setConditionsError('Unable to load conditions');
        }

        // Convert DTOs to models
        let templates: MessageTemplate[] = [];
        if (templateDtos.length > 0) {
          templates = templateDtos.map((dto: TemplateDto) =>
            templateDtoToModel(dto, selectedQueueId)
          );
          // Replace templates for this queue only, keep templates from other queues
          setMessageTemplates((prevTemplates) => {
            const templatesForOtherQueues = prevTemplates.filter(t => String(t.queueId) !== String(selectedQueueId));
            return [...templatesForOtherQueues, ...templates];
          });
          if (templates.length > 0) {
            setSelectedMessageTemplateId(templates[0].id);
          }
        } else {
          // Remove templates for this queue only
          setMessageTemplates((prevTemplates) => 
            prevTemplates.filter(t => String(t.queueId) !== String(selectedQueueId))
          );
        }

        if (conditionDtos.length > 0) {
          // Convert conditions and populate template content from templates
          const conditions: MessageCondition[] = conditionDtos.map((dto: ConditionDto, idx: number) => {
            const condition = conditionDtoToModel(dto, idx);
            // Populate template content from templateId if available
            // CRITICAL: Use String() conversion for robust type matching (handles number/string mismatches)
            if (condition.templateId && templates.length > 0) {
              // Match template by ID using String conversion for type safety
              const template = templates.find(t => String(t.id) === String(condition.templateId));
              if (template && template.content && template.content.trim().length > 0) {
                condition.template = template.content;
              } else {
                // Log warning if template not found (only in dev to avoid spam)
                if (process.env.NODE_ENV === 'development') {
                  logger.warn('[QueueContext] Template not found for condition:', {
                    conditionId: condition.id,
                    templateId: condition.templateId,
                    templateIdType: typeof condition.templateId,
                    operator: condition.operator,
                    templateFound: !!template,
                    templateHasContent: template ? !!template.content : false,
                    availableTemplateIds: templates.map(t => ({ id: t.id, idType: typeof t.id, title: t.title })),
                  });
                }
                // Keep empty template - will be handled by MessagePreviewModal
              }
            } else if (condition.templateId && templates.length === 0) {
              // Template ID exists but no templates loaded yet
              if (process.env.NODE_ENV === 'development') {
                logger.warn('[QueueContext] Condition has templateId but no templates loaded:', {
                  conditionId: condition.id,
                  templateId: condition.templateId,
                  operator: condition.operator,
                });
              }
            }
            return condition;
          });
          // Replace conditions for this queue only, keep conditions from other queues
          setMessageConditions((prevConditions) => {
            const conditionsForOtherQueues = prevConditions.filter(c => String(c.queueId) !== String(selectedQueueId));
            return [...conditionsForOtherQueues, ...conditions];
          });
        } else {
          // Remove conditions for this queue only
          setMessageConditions((prevConditions) => 
            prevConditions.filter(c => String(c.queueId) !== String(selectedQueueId))
          );
        }
      } catch (error) {
        logger.error('Unexpected error loading templates/conditions:', error);
        setTemplateError('An unexpected error occurred');
        // Only clear templates/conditions for this queue on error, not all queues
        const queueIdStr = String(selectedQueueId);
        setMessageTemplates((prev) => prev.filter(t => String(t.queueId) !== queueIdStr));
        setMessageConditions((prev) => prev.filter(c => String(c.queueId) !== queueIdStr));
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
        logger.error('Failed to create template:', error);
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
        });

        // Dispatch event to notify other components (MessagesPanel, ModeratorMessagesOverview)
        // This will trigger their refresh logic via event listeners
        window.dispatchEvent(new CustomEvent('templateDataUpdated'));

        toast?.('تم تحديث القالب بنجاح', 'success');
      } catch (error) {
        // Rollback on error
        setMessageTemplates(originalTemplates);
        const errorMsg = error instanceof Error ? error.message : 'فشل تحديث القالب';
        toast?.(errorMsg, 'error');
        logger.error('Failed to update template:', error);
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
        logger.error('Failed to delete template:', error);
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
        // Prefer provided templateId, fallback to first available template
        const targetTemplateId = condition.templateId ?? messageTemplates[0]?.id;
        if (!targetTemplateId) {
          throw new Error('لا يوجد قالب لربط الشرط به');
        }

        const templateBackendId = Number(targetTemplateId);
        if (isNaN(templateBackendId)) {
          throw new Error('معرف القالب غير صحيح');
        }

        const queueIdNum = Number(selectedQueueId);
        // Call backend
        const dto = await messageApiClient.createCondition({
          templateId: templateBackendId,
          queueId: queueIdNum,
          operator: condition.operator,
          value: condition.value,
          minValue: condition.minValue,
          maxValue: condition.maxValue,
        });

        // Replace optimistic with real condition
        const realCondition = conditionDtoToModel(dto, messageConditions.length);
        // Populate template content from templateId if available
        if (realCondition.templateId && messageTemplates.length > 0) {
          const template = messageTemplates.find(t => String(t.id) === String(realCondition.templateId));
          if (template) {
            realCondition.template = template.content;
          }
        }
        setMessageConditions((prev) =>
          prev.map((c) => (c.id === tempId ? realCondition : c))
        );

        toast?.('تم إضافة الشرط بنجاح', 'success');
      } catch (error) {
        // Remove optimistic condition on error
        setMessageConditions((prev) => prev.filter((c) => c.id !== tempId));
        const errorMsg = error instanceof Error ? error.message : 'فشل إضافة الشرط';
        toast?.(errorMsg, 'error');
        logger.error('Failed to create condition:', error);
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
        logger.error('Failed to delete condition:', error);
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

      // Update optimistically - preserve template content if not being updated
      setMessageConditions((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            const updated = { ...c, ...conditionUpdates };
            // If template content is not in updates, preserve existing template content
            if (!('template' in conditionUpdates) && c.template) {
              updated.template = c.template;
            }
            // If templateId changed, try to find new template content
            if (conditionUpdates.templateId && !updated.template && messageTemplates.length > 0) {
              const template = messageTemplates.find(t => String(t.id) === String(conditionUpdates.templateId));
              if (template) {
                updated.template = template.content;
              }
            }
            return updated;
          }
          return c;
        })
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
          value: conditionUpdates.value,
          minValue: conditionUpdates.minValue,
          maxValue: conditionUpdates.maxValue,
        });

        // Dispatch event to notify other components (MessagesPanel, ModeratorMessagesOverview)
        // This will trigger their refresh logic via event listeners
        window.dispatchEvent(new CustomEvent('conditionDataUpdated'));

        toast?.('تم تحديث الشرط بنجاح', 'success');
      } catch (error) {
        // Rollback on error
        setMessageConditions(originalConditions);
        const errorMsg = error instanceof Error ? error.message : 'فشل تحديث الشرط';
        toast?.(errorMsg, 'error');
        logger.error('Failed to update condition:', error);
      } finally {
        setIsMutatingCondition(false);
      }
    },
    [messageConditions, toast]
  );

  // NEW: Refresh templates and conditions from backend
  const refreshQueueData = useCallback(
    async (queueId: string) => {
      const queueIdNum = Number(queueId);
      if (isNaN(queueIdNum)) {
        logger.warn('Invalid queueId for refresh:', queueId);
        return;
      }

      try {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        setConditionsError(null);

        let templateDtos: TemplateDto[] = [];
        let conditionDtos: ConditionDto[] = [];

        // Fetch templates from API for the queue
        try {
          const templateResponse = await messageApiClient.getTemplates(queueIdNum);
          templateDtos = templateResponse.items || [];
        } catch (error) {
          logger.warn('Failed to refresh templates from API:', error);
          setTemplateError('Unable to refresh templates');
        }

        // Fetch conditions for this queue
        try {
          const conditionResponse = await messageApiClient.getConditions(queueIdNum);
          conditionDtos = conditionResponse.items || [];
        } catch (error) {
          logger.warn('Failed to refresh conditions:', error);
          setConditionsError('Unable to refresh conditions');
        }

        // Convert DTOs to models and update templates for this queue
        // Replace templates for this queue to ensure condition updates are reflected
        let newTemplates: MessageTemplate[] = [];
        if (templateDtos.length > 0) {
          newTemplates = templateDtos.map((dto: TemplateDto) =>
            templateDtoToModel(dto, queueId)
          );
          
          // Update templates: replace templates for this queue, keep others
          // CRITICAL FIX: Only update if templates actually changed to prevent infinite loops
          setMessageTemplates((prevTemplates) => {
            const templatesForOtherQueues = prevTemplates.filter(t => String(t.queueId) !== String(queueId));
            const existingTemplatesForQueue = prevTemplates.filter(t => String(t.queueId) === String(queueId));
            
            // Compare new templates with existing ones by ID and key properties
            // Only update if there are actual changes (different IDs, count, or content)
            const existingIds = new Set(existingTemplatesForQueue.map(t => t.id));
            const newIds = new Set(newTemplates.map(t => t.id));
            const idsChanged = existingIds.size !== newIds.size || 
                              ![...existingIds].every(id => newIds.has(id)) ||
                              ![...newIds].every(id => existingIds.has(id));
            
            // Also check if content changed (simple comparison by JSON stringify of key fields)
            const existingTemplatesStr = JSON.stringify(existingTemplatesForQueue.map(t => ({
              id: t.id,
              title: t.title,
              content: t.content,
              queueId: t.queueId
            })).sort((a, b) => String(a.id).localeCompare(String(b.id))));
            
            const newTemplatesStr = JSON.stringify(newTemplates.map(t => ({
              id: t.id,
              title: t.title,
              content: t.content,
              queueId: t.queueId
            })).sort((a, b) => String(a.id).localeCompare(String(b.id))));
            
            const contentChanged = existingTemplatesStr !== newTemplatesStr;
            
            // Only create new array if data actually changed
            if (idsChanged || contentChanged) {
              return [...templatesForOtherQueues, ...newTemplates];
            }
            
            // Return previous array reference if nothing changed (prevents unnecessary re-renders)
            return prevTemplates;
          });
          
          if (newTemplates.length > 0) {
            setSelectedMessageTemplateId(newTemplates[0].id);
          }
        }
        // NOTE: Don't remove templates if API returns empty array
        // This could be a temporary state or the templates might be loaded from another source
        // Only remove templates explicitly when a queue is deleted

        // Update conditions: replace conditions for this queue
        // Use newTemplates (just created above) instead of stale messageTemplates from closure
        if (conditionDtos.length > 0) {
          // Convert conditions and populate template content from templates
          const conditions: MessageCondition[] = conditionDtos.map((dto: ConditionDto, idx: number) => {
            const condition = conditionDtoToModel(dto, idx);
            // Populate template content from templateId if available
            // Use newTemplates (just created) instead of stale messageTemplates
            if (condition.templateId && newTemplates.length > 0) {
              // Match template by ID using simple equality (same as EditTemplateModal)
              const template = newTemplates.find(t => t.id === condition.templateId);
              if (template) {
                condition.template = template.content;
              }
            }
            return condition;
          });
          
          // Update conditions state: replace conditions for this queue, keep others
          // CRITICAL FIX: Only update if conditions actually changed to prevent infinite loops
          setMessageConditions((prevConditions) => {
            const conditionsForOtherQueues = prevConditions.filter(c => String(c.queueId) !== String(queueId));
            const existingConditionsForQueue = prevConditions.filter(c => String(c.queueId) === String(queueId));
            
            // Compare new conditions with existing ones
            const existingIds = new Set(existingConditionsForQueue.map(c => c.id));
            const newIds = new Set(conditions.map(c => c.id));
            const idsChanged = existingIds.size !== newIds.size || 
                              ![...existingIds].every(id => newIds.has(id)) ||
                              ![...newIds].every(id => existingIds.has(id));
            
            // Also check if condition properties changed
            const existingConditionsStr = JSON.stringify(existingConditionsForQueue.map(c => ({
              id: c.id,
              operator: c.operator,
              value: c.value,
              minValue: c.minValue,
              maxValue: c.maxValue,
              templateId: c.templateId,
              queueId: c.queueId
            })).sort((a, b) => String(a.id).localeCompare(String(b.id))));
            
            const newConditionsStr = JSON.stringify(conditions.map(c => ({
              id: c.id,
              operator: c.operator,
              value: c.value,
              minValue: c.minValue,
              maxValue: c.maxValue,
              templateId: c.templateId,
              queueId: c.queueId
            })).sort((a, b) => String(a.id).localeCompare(String(b.id))));
            
            const contentChanged = existingConditionsStr !== newConditionsStr;
            
            // Only create new array if data actually changed
            if (idsChanged || contentChanged) {
              return [...conditionsForOtherQueues, ...conditions];
            }
            
            // Return previous array reference if nothing changed (prevents unnecessary re-renders)
            return prevConditions;
          });
        } else {
          // If no conditions for this queue, remove them
          // CRITICAL FIX: Only update if there were actually conditions to remove
          setMessageConditions((prevConditions) => {
            const hasConditionsForQueue = prevConditions.some(c => String(c.queueId) === String(queueId));
            if (hasConditionsForQueue) {
              return prevConditions.filter(c => String(c.queueId) !== String(queueId));
            }
            // Return previous array reference if nothing to remove
            return prevConditions;
          });
        }
      } catch (error) {
        logger.error('Unexpected error refreshing queue data:', error);
        setTemplateError('An unexpected error occurred while refreshing');
      } finally {
        setIsLoadingTemplates(false);
      }
    },
    []
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
        refreshQueues,
        selectedQueueId,
        setSelectedQueueId,
        patients,
        addPatient,
        updatePatient,
        deletePatient,
        reorderPatients,
        refreshPatients,
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
        setMessageTemplates,
        selectedMessageTemplateId,
        setSelectedMessageTemplateId,
        messageConditions,
        addMessageCondition,
        removeMessageCondition,
        updateMessageCondition,
        setMessageConditions,
        refreshQueueData,  // NEW
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
