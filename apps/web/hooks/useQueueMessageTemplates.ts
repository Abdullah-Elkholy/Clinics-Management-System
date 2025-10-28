/**
 * useQueueMessageTemplates Hook
 * File: apps/web/hooks/useQueueMessageTemplates.ts
 * 
 * Custom hook for managing message templates per queue
 * Handles loading, creating, updating, and deleting templates
 */

import { useCallback, useEffect, useState } from 'react';
import {
  MessageTemplate,
  QueueTemplateConfig,
  getQueueTemplateConfig,
  getQueueTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  toggleTemplateStatus,
} from '@/services/messageTemplateService';

interface UseQueueMessageTemplatesOptions {
  queueId?: string;
  queueName?: string;
  autoLoad?: boolean;
}

interface UseQueueMessageTemplatesReturn {
  // State
  config: QueueTemplateConfig | null;
  templates: MessageTemplate[];
  loading: boolean;
  error: string | null;

  // Methods
  loadTemplates: (id?: string) => Promise<void>;
  createNew: (data: Omit<MessageTemplate, 'id' | 'createdAt' | 'queueId'>) => Promise<MessageTemplate | null>;
  update: (templateId: string, data: Partial<MessageTemplate>) => Promise<MessageTemplate | null>;
  delete: (templateId: string) => Promise<boolean>;
  duplicate: (templateId: string, newTitle?: string) => Promise<MessageTemplate | null>;
  toggleStatus: (templateId: string) => Promise<MessageTemplate | null>;
  refresh: () => Promise<void>;
}

export function useQueueMessageTemplates(options: UseQueueMessageTemplatesOptions = {}): UseQueueMessageTemplatesReturn {
  const { queueId, queueName = 'Queue', autoLoad = true } = options;

  const [config, setConfig] = useState<QueueTemplateConfig | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load templates for queue
   */
  const loadTemplates = useCallback(
    async (id?: string) => {
      const targetId = id || queueId;
      if (!targetId) {
        setError('Queue ID is required');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const cfg = await getQueueTemplateConfig(targetId, queueName);
        setConfig(cfg);
        setTemplates(cfg.templates || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load templates';
        setError(message);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    },
    [queueId, queueName]
  );

  /**
   * Create new template
   */
  const createNew = useCallback(
    async (data: Omit<MessageTemplate, 'id' | 'createdAt' | 'queueId'>) => {
      if (!queueId || !config) {
        setError('Queue configuration required');
        return null;
      }

      try {
        const newTemplate = await createTemplate(queueId, queueName, data);
        if (newTemplate) {
          setTemplates((prev) => [...prev, newTemplate]);
          return newTemplate;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create template';
        setError(message);
        return null;
      }
    },
    [queueId, queueName, config]
  );

  /**
   * Update template
   */
  const update = useCallback(
    async (templateId: string, data: Partial<MessageTemplate>) => {
      if (!queueId || !config) {
        setError('Queue configuration required');
        return null;
      }

      try {
        const updated = await updateTemplate(queueId, queueName, templateId, data);
        if (updated) {
          setTemplates((prev) =>
            prev.map((t) => (t.id === templateId ? updated : t))
          );
          return updated;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update template';
        setError(message);
        return null;
      }
    },
    [queueId, queueName, config]
  );

  /**
   * Delete template
   */
  const deleteTemplate_fn = useCallback(
    async (templateId: string) => {
      if (!queueId || !config) {
        setError('Queue configuration required');
        return false;
      }

      try {
        const success = await deleteTemplate(queueId, queueName, templateId);
        if (success) {
          setTemplates((prev) => prev.filter((t) => t.id !== templateId));
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete template';
        setError(message);
        return false;
      }
    },
    [queueId, queueName, config]
  );

  /**
   * Duplicate template
   */
  const duplicateTemplate_fn = useCallback(
    async (templateId: string, newTitle?: string) => {
      if (!queueId || !config) {
        setError('Queue configuration required');
        return null;
      }

      try {
        const dup = await duplicateTemplate(queueId, queueName, templateId, newTitle);
        if (dup) {
          setTemplates((prev) => [...prev, dup]);
          return dup;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to duplicate template';
        setError(message);
        return null;
      }
    },
    [queueId, queueName, config]
  );

  /**
   * Toggle template status
   */
  const toggleStatus = useCallback(
    async (templateId: string) => {
      if (!queueId || !config) {
        setError('Queue configuration required');
        return null;
      }

      try {
        const updated = await toggleTemplateStatus(queueId, queueName, templateId);
        if (updated) {
          setTemplates((prev) =>
            prev.map((t) => (t.id === templateId ? updated : t))
          );
          return updated;
        }
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to toggle template status';
        setError(message);
        return null;
      }
    },
    [queueId, queueName, config]
  );

  /**
   * Refresh templates
   */
  const refresh = useCallback(async () => {
    await loadTemplates();
  }, [loadTemplates]);

  /**
   * Auto-load on mount or when queueId changes
   */
  useEffect(() => {
    if (autoLoad && queueId) {
      loadTemplates();
    }
  }, [queueId, autoLoad, loadTemplates]);

  return {
    config,
    templates,
    loading,
    error,
    loadTemplates,
    createNew,
    update,
    delete: deleteTemplate_fn,
    duplicate: duplicateTemplate_fn,
    toggleStatus,
    refresh,
  };
}
