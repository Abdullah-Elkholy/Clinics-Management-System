/**
 * Hook for managing queue message configurations
 * Handles loading, saving, and updating conditions
 */

import { useState, useEffect, useCallback } from 'react';
import { QueueMessageConfig, MessageCondition } from '@/types/messageCondition';
import {
  getQueueMessageConfig,
  saveQueueMessageConfig,
  removeConditionFromQueue,
  updateConditionInQueue,
  initializeQueueMessageConfig,
} from '@/services/messageConfigService';

export interface UseQueueMessageConfigOptions {
  queueId?: string;
  queueName?: string;
  autoLoad?: boolean;
  defaultTemplate?: string;
}

export function useQueueMessageConfig(options: UseQueueMessageConfigOptions = {}) {
  const {
    queueId,
    queueName = '',
    autoLoad = true,
    defaultTemplate = 'مرحباً بك {PN}',
  } = options;

  const [config, setConfig] = useState<QueueMessageConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load config
  const loadConfig = useCallback(async (id?: string) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getQueueMessageConfig(id);
      if (data) {
        setConfig(data);
      } else {
        // Initialize new config if doesn't exist
        const newConfig = await initializeQueueMessageConfig(id, queueName, defaultTemplate);
        setConfig(newConfig);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [queueName, defaultTemplate]);

  // Auto-load on mount or when queueId changes
  useEffect(() => {
    if (autoLoad && queueId) {
      loadConfig(queueId);
    }
  }, [queueId, autoLoad, loadConfig]);

  // Save entire config
  const saveConfig = useCallback(async (newConfig: QueueMessageConfig) => {
    if (!newConfig.queueId) return false;

    setLoading(true);
    setError(null);
    try {
      const success = await saveQueueMessageConfig(newConfig.queueId, newConfig);
      if (success) {
        setConfig(newConfig);
        return true;
      }
      setError('Failed to save configuration');
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save config';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update config (for local state before save)
  const updateConfig = useCallback((updates: Partial<QueueMessageConfig>) => {
    setConfig(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // Update conditions
  const updateConditions = useCallback((conditions: MessageCondition[]) => {
    updateConfig({ conditions });
  }, [updateConfig]);

  // Add condition
  const addCondition = useCallback((condition: MessageCondition) => {
    if (!config) return;
    const newConditions = [...config.conditions, condition];
    newConditions.sort((a, b) => a.priority - b.priority);
    updateConditions(newConditions);
  }, [config, updateConditions]);

  // Remove condition
  const removeCondition = useCallback((conditionId: string) => {
    if (!config) return;
    const newConditions = config.conditions.filter(c => c.id !== conditionId);
    updateConditions(newConditions);
  }, [config, updateConditions]);

  // Update condition
  const updateCondition = useCallback((conditionId: string, updates: Partial<MessageCondition>) => {
    if (!config) return;
    const newConditions = config.conditions.map(c =>
      c.id === conditionId ? { ...c, ...updates } : c
    );
    newConditions.sort((a, b) => a.priority - b.priority);
    updateConditions(newConditions);
  }, [config, updateConditions]);

  // Update default template
  const updateDefaultTemplate = useCallback((template: string) => {
    updateConfig({ defaultTemplate: template });
  }, [updateConfig]);

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    updateConfig,
    updateConditions,
    addCondition,
    removeCondition,
    updateCondition,
    updateDefaultTemplate,
  };
}

export default useQueueMessageConfig;
