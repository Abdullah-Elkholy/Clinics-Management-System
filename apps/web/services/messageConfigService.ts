/**
 * Message Configuration Service
 * Handles loading and managing queue-specific message conditions
 * Using localStorage for persistence (no backend integration yet)
 */

import { QueueMessageConfig, MessageCondition } from '@/types/messageCondition';

const STORAGE_KEY_PREFIX = 'queueConfig_';

/**
 * Get message configuration for a queue from localStorage
 */
export async function getQueueMessageConfig(queueId: string): Promise<QueueMessageConfig | null> {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${queueId}`);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as QueueMessageConfig;
  } catch (error) {
    console.error('Failed to fetch queue message config:', error);
    return null;
  }
}

/**
 * Save message configuration for a queue to localStorage
 */
export async function saveQueueMessageConfig(queueId: string, config: QueueMessageConfig): Promise<boolean> {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${queueId}`, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Failed to save queue message config:', error);
    return false;
  }
}

/**
 * Delete message configuration for a queue from localStorage
 */
export async function deleteQueueMessageConfig(queueId: string): Promise<boolean> {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${queueId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete queue message config:', error);
    return false;
  }
}

/**
 * Add a single condition to existing config
 */
export async function addConditionToQueue(
  queueId: string,
  condition: MessageCondition
): Promise<QueueMessageConfig | null> {
  try {
    const config = await getQueueMessageConfig(queueId);
    if (!config) {
      return null;
    }

    const newConditions = [...config.conditions, condition];
    newConditions.sort((a, b) => a.priority - b.priority);

    const updated = { ...config, conditions: newConditions };
    const success = await saveQueueMessageConfig(queueId, updated);
    return success ? updated : null;
  } catch (error) {
    console.error('Failed to add condition:', error);
    return null;
  }
}

/**
 * Remove a condition from config
 */
export async function removeConditionFromQueue(queueId: string, conditionId: string): Promise<QueueMessageConfig | null> {
  try {
    const config = await getQueueMessageConfig(queueId);
    if (!config) {
      return null;
    }

    const newConditions = config.conditions.filter(c => c.id !== conditionId);
    const updated = { ...config, conditions: newConditions };
    const success = await saveQueueMessageConfig(queueId, updated);
    return success ? updated : null;
  } catch (error) {
    console.error('Failed to remove condition:', error);
    return null;
  }
}

/**
 * Update a specific condition
 */
export async function updateConditionInQueue(
  queueId: string,
  conditionId: string,
  updates: Partial<MessageCondition>
): Promise<QueueMessageConfig | null> {
  try {
    const config = await getQueueMessageConfig(queueId);
    if (!config) {
      return null;
    }

    const newConditions = config.conditions.map(c =>
      c.id === conditionId ? { ...c, ...updates } : c
    );
    newConditions.sort((a, b) => a.priority - b.priority);

    const updated = { ...config, conditions: newConditions };
    const success = await saveQueueMessageConfig(queueId, updated);
    return success ? updated : null;
  } catch (error) {
    console.error('Failed to update condition:', error);
    return null;
  }
}

/**
 * Create a new default config for a queue
 */
export async function initializeQueueMessageConfig(
  queueId: string,
  queueName: string,
  defaultTemplate: string = 'مرحباً بك {PN}'
): Promise<QueueMessageConfig | null> {
  try {
    const config: QueueMessageConfig = {
      queueId,
      queueName,
      defaultTemplate,
      conditions: [],
    };

    const success = await saveQueueMessageConfig(queueId, config);
    return success ? config : null;
  } catch (error) {
    console.error('Failed to initialize queue message config:', error);
    return null;
  }
}

/**
 * Get all configs from localStorage
 */
export async function getAllQueueMessageConfigs(): Promise<QueueMessageConfig[]> {
  try {
    const configs: QueueMessageConfig[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          configs.push(JSON.parse(stored) as QueueMessageConfig);
        }
      }
    }
    return configs;
  } catch (error) {
    console.error('Failed to fetch all configs:', error);
    return [];
  }
}

export default {
  getQueueMessageConfig,
  saveQueueMessageConfig,
  deleteQueueMessageConfig,
  addConditionToQueue,
  removeConditionFromQueue,
  updateConditionInQueue,
  initializeQueueMessageConfig,
  getAllQueueMessageConfigs,
};
