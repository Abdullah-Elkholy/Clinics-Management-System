/**
 * Message Template Service
 * File: apps/web/services/messageTemplateService.ts
 * 
 * Handles CRUD operations for message templates per queue
 * Storage: localStorage with key pattern `queueTemplates_${queueId}`
 */

export interface MessageTemplate {
  id: string;
  queueId: string;
  title: string;
  description?: string;
  content: string;
  variables: string[];
  isActive: boolean;
  priority?: number;
  
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface QueueTemplateConfig {
  queueId: string;
  queueName: string;
  templates: MessageTemplate[];
  defaultTemplate?: string;
  totalConditions?: number;
}

export interface MessageServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_KEY_PREFIX = 'queueTemplates_';

/**
 * Get all templates for a specific queue
 */
export async function getQueueTemplates(queueId: string): Promise<MessageTemplate[]> {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${queueId}`);
    if (!stored) {
      return [];
    }
    const config: QueueTemplateConfig = JSON.parse(stored);
    return config.templates || [];
  } catch (error) {
    console.error('Failed to fetch queue templates:', error);
    return [];
  }
}

/**
 * Get queue template config (includes metadata)
 */
export async function getQueueTemplateConfig(queueId: string, queueName: string): Promise<QueueTemplateConfig> {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${queueId}`);
    if (!stored) {
      return {
        queueId,
        queueName,
        templates: [],
      };
    }
    return JSON.parse(stored) as QueueTemplateConfig;
  } catch (error) {
    console.error('Failed to fetch queue template config:', error);
    return {
      queueId,
      queueName,
      templates: [],
    };
  }
}

/**
 * Save all templates for a queue
 */
export async function saveQueueTemplates(queueId: string, queueName: string, templates: MessageTemplate[]): Promise<boolean> {
  try {
    const config: QueueTemplateConfig = {
      queueId,
      queueName,
      templates,
      totalConditions: 0,
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${queueId}`, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Failed to save queue templates:', error);
    return false;
  }
}

/**
 * Create new template in queue
 */
export async function createTemplate(
  queueId: string,
  queueName: string,
  data: Omit<MessageTemplate, 'id' | 'createdAt' | 'queueId'>
): Promise<MessageTemplate | null> {
  try {
    const templates = await getQueueTemplates(queueId);
    
    const newTemplate: MessageTemplate = {
      ...data,
      queueId,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    templates.push(newTemplate);
    const success = await saveQueueTemplates(queueId, queueName, templates);
    
    return success ? newTemplate : null;
  } catch (error) {
    console.error('Failed to create template:', error);
    return null;
  }
}

/**
 * Update existing template
 */
export async function updateTemplate(
  queueId: string,
  queueName: string,
  templateId: string,
  updates: Partial<MessageTemplate>
): Promise<MessageTemplate | null> {
  try {
    const templates = await getQueueTemplates(queueId);
    const index = templates.findIndex(t => t.id === templateId);

    if (index === -1) {
      return null;
    }

    templates[index] = {
      ...templates[index],
      ...updates,
      id: templates[index].id,
      queueId: templates[index].queueId,
      createdAt: templates[index].createdAt,
      updatedAt: new Date(),
    };

    const success = await saveQueueTemplates(queueId, queueName, templates);
    return success ? templates[index] : null;
  } catch (error) {
    console.error('Failed to update template:', error);
    return null;
  }
}

/**
 * Delete template from queue
 */
export async function deleteTemplate(queueId: string, queueName: string, templateId: string): Promise<boolean> {
  try {
    const templates = await getQueueTemplates(queueId);
    const filtered = templates.filter(t => t.id !== templateId);
    
    return await saveQueueTemplates(queueId, queueName, filtered);
  } catch (error) {
    console.error('Failed to delete template:', error);
    return false;
  }
}

/**
 * Duplicate template in same queue
 */
export async function duplicateTemplate(
  queueId: string,
  queueName: string,
  templateId: string,
  newTitle?: string
): Promise<MessageTemplate | null> {
  try {
    const templates = await getQueueTemplates(queueId);
    const original = templates.find(t => t.id === templateId);

    if (!original) {
      return null;
    }

    const duplicate: MessageTemplate = {
      ...original,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: newTitle || `${original.title} (نسخة)`,
      createdAt: new Date(),
      updatedAt: undefined,
    };

    templates.push(duplicate);
    const success = await saveQueueTemplates(queueId, queueName, templates);

    return success ? duplicate : null;
  } catch (error) {
    console.error('Failed to duplicate template:', error);
    return null;
  }
}

/**
 * Get all queues with templates
 */
export async function getAllQueueTemplateConfigs(): Promise<QueueTemplateConfig[]> {
  try {
    const configs: QueueTemplateConfig[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          configs.push(JSON.parse(stored) as QueueTemplateConfig);
        }
      }
    }
    return configs;
  } catch (error) {
    console.error('Failed to fetch all configs:', error);
    return [];
  }
}

/**
 * Set default template for queue
 */
export async function setDefaultTemplate(queueId: string, queueName: string, templateContent: string): Promise<boolean> {
  try {
    const config = await getQueueTemplateConfig(queueId, queueName);
    config.defaultTemplate = templateContent;
    return await saveQueueTemplates(queueId, queueName, config.templates);
  } catch (error) {
    console.error('Failed to set default template:', error);
    return false;
  }
}

/**
 * Toggle template active status
 */
export async function toggleTemplateStatus(queueId: string, queueName: string, templateId: string): Promise<MessageTemplate | null> {
  try {
    const templates = await getQueueTemplates(queueId);
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return null;
    }

    template.isActive = !template.isActive;
    template.updatedAt = new Date();

    const success = await saveQueueTemplates(queueId, queueName, templates);
    return success ? template : null;
  } catch (error) {
    console.error('Failed to toggle template status:', error);
    return null;
  }
}

/**
 * Validate template
 */
export function validateTemplate(template: MessageTemplate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.title || template.title.trim() === '') {
    errors.push('العنوان مطلوب');
  }

  if (!template.content || template.content.trim() === '') {
    errors.push('محتوى الرسالة مطلوب');
  }

  const validVariables = ['PN', 'PQP', 'CQP', 'ETR', 'QN', 'DR', 'DN'];
  const variableRegex = /{([^}]+)}/g;
  const usedVariables = new Set<string>();
  let match;
  while ((match = variableRegex.exec(template.content)) !== null) {
    usedVariables.add(match[1]);
  }

  usedVariables.forEach(v => {
    if (!validVariables.includes(v)) {
      errors.push(`متغير غير معروف: {${v}}`);
    }
  });

  return { valid: errors.length === 0, errors };
}
