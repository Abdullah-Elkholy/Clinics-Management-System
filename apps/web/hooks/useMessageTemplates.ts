/**
 * useMessageTemplates Hook - DEPRECATED
 * Use useQueueMessageTemplates instead
 * This is kept for backward compatibility with existing components
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { MessageTemplate, getAllQueueTemplateConfigs, validateTemplate as validateTemplateService } from '@/services/messageTemplateService';

export interface useMessageTemplatesState {
  templates: MessageTemplate[];
  loading: boolean;
  error: string | null;
}

export interface useMessageTemplatesActions {
  fetchTemplates: () => Promise<void>;
  getTemplate: (id: string) => MessageTemplate | undefined;
  validateTemplate: (template: MessageTemplate) => { valid: boolean; errors: string[] };
  clearError: () => void;
}

/**
 * Load all templates from all queues for admin/general purposes
 * @deprecated Use useQueueMessageTemplates instead for queue-specific templates
 */
export const useMessageTemplates = (): [useMessageTemplatesState, useMessageTemplatesActions] => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configs = await getAllQueueTemplateConfigs();
      const allTemplates = configs.flatMap(cfg => cfg.templates || []);
      setTemplates(allTemplates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(message);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTemplate = useCallback((id: string) => {
    return templates.find(t => t.id === id);
  }, [templates]);

  const validateTemplate = useCallback((template: MessageTemplate) => {
    return validateTemplateService(template);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const state: useMessageTemplatesState = {
    templates,
    loading,
    error,
  };

  const actions: useMessageTemplatesActions = {
    fetchTemplates,
    getTemplate,
    validateTemplate,
    clearError,
  };

  return [state, actions];
};
