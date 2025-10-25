/**
 * useMessageTemplates Hook - State management for message templates
 * SOLID: Single Responsibility - Only manages message template state
 * Reusable across Messages Panel and other components
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { messageTemplateService, MessageTemplate, MessageCondition, MessageServiceResponse } from '@/services/messageTemplateService';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { Feature } from '@/types/roles';
import { canAccess } from '@/lib/authz';

export interface useMessageTemplatesState {
  templates: MessageTemplate[];
  conditions: Record<string, MessageCondition[]>; // templateId -> conditions
  loading: boolean;
  error: string | null;
}

export interface useMessageTemplatesActions {
  // Template actions
  fetchTemplates: () => Promise<void>;
  getTemplate: (id: string) => MessageTemplate | undefined;
  createTemplate: (template: Omit<MessageTemplate, 'id' | 'createdAt'>) => Promise<boolean>;
  updateTemplate: (id: string, updates: Partial<MessageTemplate>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  validateTemplate: (template: MessageTemplate) => { valid: boolean; errors: string[] };

  // Condition actions
  fetchConditions: (templateId: string) => Promise<void>;
  createCondition: (condition: Omit<MessageCondition, 'id'>) => Promise<boolean>;
  deleteCondition: (id: string) => Promise<boolean>;

  // Utilities
  clearError: () => void;
}

/**
 * Hook for managing message templates with full CRUD operations
 * Handles loading, error states, and caching
 */
export const useMessageTemplates = (): [useMessageTemplatesState, useMessageTemplatesActions] => {
  const { addToast } = useUI();
  const { user } = useAuth();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [conditions, setConditions] = useState<Record<string, MessageCondition[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check permissions
  const canCreate = useMemo(
    () => canAccess(user?.role as any, Feature.CREATE_MESSAGE_TEMPLATE),
    [user?.role]
  );
  const canEdit = useMemo(
    () => canAccess(user?.role as any, Feature.EDIT_MESSAGE_TEMPLATE),
    [user?.role]
  );
  const canDelete = useMemo(
    () => canAccess(user?.role as any, Feature.DELETE_MESSAGE_TEMPLATE),
    [user?.role]
  );

  /**
   * Fetch all templates
   */
  const fetchTemplates = useCallback(async () => {
    if (!canAccess(user?.role as any, Feature.VIEW_MESSAGES)) {
      setError('ليس لديك صلاحية لعرض الرسائل');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await messageTemplateService.getTemplates({
        moderatorId: user?.moderatorId,
      });

      if (response.success && response.data) {
        setTemplates(response.data);
      } else {
        setError(response.error || 'فشل تحميل الرسائل');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تحميل الرسائل');
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.moderatorId]);

  /**
   * Get single template from state
   */
  const getTemplate = useCallback((id: string) => {
    return templates.find(t => t.id === id);
  }, [templates]);

  /**
   * Create new template
   */
  const createTemplate = useCallback(
    async (templateData: Omit<MessageTemplate, 'id' | 'createdAt'>) => {
      if (!canCreate) {
        addToast('ليس لديك صلاحية لإنشاء رسائل', 'error');
        return false;
      }

      // Validate template first
      const validation = messageTemplateService.validateTemplate(templateData as any);
      if (!validation.valid) {
        setError(validation.errors.join(' ، '));
        addToast(validation.errors[0], 'error');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await messageTemplateService.createTemplate(templateData);
        if (response.success && response.data) {
          setTemplates([...templates, response.data]);
          addToast('تم إنشاء الرسالة بنجاح', 'success');
          return true;
        } else {
          setError(response.error || 'فشل إنشاء الرسالة');
          addToast(response.error || 'فشل إنشاء الرسالة', 'error');
          return false;
        }
      } catch (err) {
        setError('حدث خطأ أثناء إنشاء الرسالة');
        addToast('حدث خطأ أثناء إنشاء الرسالة', 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [templates, canCreate, addToast]
  );

  /**
   * Update existing template
   */
  const updateTemplate = useCallback(
    async (id: string, updates: Partial<MessageTemplate>) => {
      if (!canEdit) {
        addToast('ليس لديك صلاحية لتعديل الرسائل', 'error');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await messageTemplateService.updateTemplate(id, updates);
        if (response.success && response.data) {
          setTemplates(templates.map(t => (t.id === id ? response.data! : t)));
          addToast('تم تحديث الرسالة بنجاح', 'success');
          return true;
        } else {
          setError(response.error || 'فشل تحديث الرسالة');
          addToast(response.error || 'فشل تحديث الرسالة', 'error');
          return false;
        }
      } catch (err) {
        setError('حدث خطأ أثناء تحديث الرسالة');
        addToast('حدث خطأ أثناء تحديث الرسالة', 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [templates, canEdit, addToast]
  );

  /**
   * Delete template
   */
  const deleteTemplate = useCallback(
    async (id: string) => {
      if (!canDelete) {
        addToast('ليس لديك صلاحية لحذف الرسائل', 'error');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await messageTemplateService.deleteTemplate(id);
        if (response.success) {
          setTemplates(templates.filter(t => t.id !== id));
          setConditions(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
          });
          addToast('تم حذف الرسالة بنجاح', 'success');
          return true;
        } else {
          setError(response.error || 'فشل حذف الرسالة');
          addToast(response.error || 'فشل حذف الرسالة', 'error');
          return false;
        }
      } catch (err) {
        setError('حدث خطأ أثناء حذف الرسالة');
        addToast('حدث خطأ أثناء حذف الرسالة', 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [templates, canDelete, addToast]
  );

  /**
   * Validate template
   */
  const validateTemplate = useCallback((template: MessageTemplate) => {
    return messageTemplateService.validateTemplate(template);
  }, []);

  /**
   * Fetch conditions for a template
   */
  const fetchConditions = useCallback(
    async (templateId: string) => {
      if (!canAccess(user?.role as any, Feature.VIEW_MESSAGES)) {
        return;
      }

      try {
        const response = await messageTemplateService.getConditions(templateId);
        if (response.success && response.data) {
          setConditions(prev => ({ ...prev, [templateId]: response.data! }));
        }
      } catch (err) {
        console.error('Failed to fetch conditions:', err);
      }
    },
    [user?.role]
  );

  /**
   * Create condition
   */
  const createCondition = useCallback(
    async (conditionData: Omit<MessageCondition, 'id'>) => {
      if (!canCreate) {
        addToast('ليس لديك صلاحية لإنشاء شروط', 'error');
        return false;
      }

      try {
        const response = await messageTemplateService.createCondition(conditionData);
        if (response.success && response.data) {
          setConditions(prev => ({
            ...prev,
            [conditionData.templateId]: [...(prev[conditionData.templateId] || []), response.data!],
          }));
          addToast('تم إنشاء الشرط بنجاح', 'success');
          return true;
        } else {
          addToast(response.error || 'فشل إنشاء الشرط', 'error');
          return false;
        }
      } catch (err) {
        addToast('حدث خطأ أثناء إنشاء الشرط', 'error');
        return false;
      }
    },
    [canCreate, addToast]
  );

  /**
   * Delete condition
   */
  const deleteCondition = useCallback(
    async (id: string) => {
      if (!canDelete) {
        addToast('ليس لديك صلاحية لحذف الشروط', 'error');
        return false;
      }

      try {
        const response = await messageTemplateService.deleteCondition(id);
        if (response.success) {
          // Remove condition from all templates
          setConditions(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
              updated[key] = updated[key].filter(c => c.id !== id);
            });
            return updated;
          });
          addToast('تم حذف الشرط بنجاح', 'success');
          return true;
        } else {
          addToast(response.error || 'فشل حذف الشرط', 'error');
          return false;
        }
      } catch (err) {
        addToast('حدث خطأ أثناء حذف الشرط', 'error');
        return false;
      }
    },
    [canDelete, addToast]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const state: useMessageTemplatesState = {
    templates,
    conditions,
    loading,
    error,
  };

  const actions: useMessageTemplatesActions = {
    fetchTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    validateTemplate,
    fetchConditions,
    createCondition,
    deleteCondition,
    clearError,
  };

  return [state, actions];
};
