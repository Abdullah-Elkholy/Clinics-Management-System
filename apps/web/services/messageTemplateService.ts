/**
 * Message Template Service - Business logic for message management
 * SOLID: Single Responsibility - Only handles message template operations
 * SOLID: Dependency Inversion - Can be replaced with different implementations
 */

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  variables: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  moderatorId?: string; // For moderator-specific templates
}

export interface MessageCondition {
  id: string;
  templateId: string;
  type: 'range' | 'lessThan' | 'greaterThan' | 'equals';
  field: string; // e.g., 'queuePosition', 'waitTime'
  minValue?: number;
  maxValue?: number;
  value?: number;
  description: string;
}

export interface MessageServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Message Template Service - Handles all message template operations
 * In production, this would make API calls
 */
class MessageTemplateService {
  private templates: MessageTemplate[] = [
    {
      id: '1',
      title: 'الترحيب',
      content: 'مرحباً {PN}، ترتيبك {PQP} والموضع الحالي {CQP}',
      variables: ['PN', 'PQP', 'CQP'],
      createdBy: 'admin',
      createdAt: new Date('2024-01-10'),
    },
    {
      id: '2',
      title: 'دورك يقترب',
      content: 'مرحباً {PN}، دورك سيأتي قريباً. موضعك الحالي {CQP}',
      variables: ['PN', 'CQP'],
      createdBy: 'admin',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: '3',
      title: 'تأكيد الموعد',
      content: 'تأكيد موعدك يا {PN} مع {DR} - ترتيب الطابور: {QN}',
      variables: ['PN', 'DR', 'QN'],
      createdBy: 'fatima.mod@clinic.com',
      createdAt: new Date('2024-02-05'),
      moderatorId: '3',
    },
    {
      id: '4',
      title: 'تذكير قبل الموعد',
      content: 'تذكير يا {PN}، موعدك غداً الساعة {ETR} مع الدكتور {DR}. الرجاء الحضور في الموعد المحدد.',
      variables: ['PN', 'ETR', 'DR'],
      createdBy: 'mahmoud.mod@clinic.com',
      createdAt: new Date('2024-02-10'),
      moderatorId: '4',
    },
    {
      id: '5',
      title: 'تنبيه زمن الانتظار',
      content: 'عذراً يا {PN}، هناك تأخير في الخدمة. وقت الانتظار المتوقع: {ETR}. شكراً لصبرك.',
      variables: ['PN', 'ETR'],
      createdBy: 'admin',
      createdAt: new Date('2024-03-01'),
    },
    {
      id: '6',
      title: 'رسالة إلغاء الموعد',
      content: 'تنبيه: تم إلغاء موعد {PN} مع {DR}. الترتيب: {PQP}. يرجى الاتصال للحجز مجدداً.',
      variables: ['PN', 'DR', 'PQP'],
      createdBy: 'admin',
      createdAt: new Date('2024-03-05'),
    },
    {
      id: '7',
      title: 'استقبال الطبيب',
      content: 'أهلاً وسهلاً {PN}، يرجى التوجه للعيادة {QN}. الدكتور {DR} ينتظرك.',
      variables: ['PN', 'QN', 'DR'],
      createdBy: 'fatima.mod@clinic.com',
      createdAt: new Date('2024-03-12'),
      moderatorId: '3',
    },
    {
      id: '8',
      title: 'رسالة بعد الانتهاء',
      content: 'شكراً {PN} على زيارتك. نتمنى لك الصحة والعافية. موعدك القادم {ETR}.',
      variables: ['PN', 'ETR'],
      createdBy: 'admin',
      createdAt: new Date('2024-03-15'),
    },
    {
      id: '9',
      title: 'إشعار بتغيير الطبيب',
      content: 'تم تعديل موعدك {PN}. الطبيب الجديد: {DR}. الترتيب الجديد: {PQP}. الرجاء التأكيد.',
      variables: ['PN', 'DR', 'PQP'],
      createdBy: 'mahmoud.mod@clinic.com',
      createdAt: new Date('2024-04-01'),
      moderatorId: '4',
    },
    {
      id: '10',
      title: 'دعوة لإعادة جدولة',
      content: 'لم نرك منذ فترة يا {PN}! هل تود إعادة جدولة موعدك مع {DR}؟ موعدك المتاح {ETR}.',
      variables: ['PN', 'DR', 'ETR'],
      createdBy: 'admin',
      createdAt: new Date('2024-04-10'),
    },
  ];

  private conditions: MessageCondition[] = [];

  /**
   * Get all templates (with optional filtering)
   */
  async getTemplates(filters?: { moderatorId?: string }): Promise<MessageServiceResponse<MessageTemplate[]>> {
    try {
      let filtered = this.templates;
      if (filters?.moderatorId) {
        filtered = filtered.filter(
          t => !t.moderatorId || t.moderatorId === filters.moderatorId || !('moderatorId' in t)
        );
      }
      return { success: true, data: filtered };
    } catch (error) {
      return { success: false, error: 'Failed to fetch templates' };
    }
  }

  /**
   * Get single template by ID
   */
  async getTemplate(id: string): Promise<MessageServiceResponse<MessageTemplate>> {
    try {
      const template = this.templates.find(t => t.id === id);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }
      return { success: true, data: template };
    } catch (error) {
      return { success: false, error: 'Failed to fetch template' };
    }
  }

  /**
   * Create new template
   */
  async createTemplate(data: Omit<MessageTemplate, 'id' | 'createdAt'>): Promise<MessageServiceResponse<MessageTemplate>> {
    try {
      const template: MessageTemplate = {
        ...data,
        id: `template_${Date.now()}`,
        createdAt: new Date(),
      };
      this.templates.push(template);
      return { success: true, data: template };
    } catch (error) {
      return { success: false, error: 'Failed to create template' };
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(id: string, data: Partial<MessageTemplate>): Promise<MessageServiceResponse<MessageTemplate>> {
    try {
      const index = this.templates.findIndex(t => t.id === id);
      if (index === -1) {
        return { success: false, error: 'Template not found' };
      }
      const updated = { ...this.templates[index], ...data, updatedAt: new Date() };
      this.templates[index] = updated;
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Failed to update template' };
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<MessageServiceResponse<void>> {
    try {
      const index = this.templates.findIndex(t => t.id === id);
      if (index === -1) {
        return { success: false, error: 'Template not found' };
      }
      this.templates.splice(index, 1);
      // Also delete associated conditions
      this.conditions = this.conditions.filter(c => c.templateId !== id);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to delete template' };
    }
  }

  /**
   * Validate template - Check if all variables are valid
   */
  validateTemplate(template: MessageTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.title || template.title.trim() === '') {
      errors.push('العنوان مطلوب');
    }

    if (!template.content || template.content.trim() === '') {
      errors.push('محتوى الرسالة مطلوب');
    }

    // Check for undefined variables in content
    const variableRegex = /{([^}]+)}/g;
    const usedVariables = new Set<string>();
    let match;
    while ((match = variableRegex.exec(template.content)) !== null) {
      usedVariables.add(match[1]);
    }

    // Verify all used variables are in the variables list
    const validVariables = ['PN', 'PQP', 'CQP', 'ETR', 'QN', 'DR'];
    usedVariables.forEach(v => {
      if (!validVariables.includes(v)) {
        errors.push(`متغير غير معروف: {${v}}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get all conditions for a template
   */
  async getConditions(templateId: string): Promise<MessageServiceResponse<MessageCondition[]>> {
    try {
      const conditions = this.conditions.filter(c => c.templateId === templateId);
      return { success: true, data: conditions };
    } catch (error) {
      return { success: false, error: 'Failed to fetch conditions' };
    }
  }

  /**
   * Create condition
   */
  async createCondition(data: Omit<MessageCondition, 'id'>): Promise<MessageServiceResponse<MessageCondition>> {
    try {
      const condition: MessageCondition = {
        ...data,
        id: `condition_${Date.now()}`,
      };
      this.conditions.push(condition);
      return { success: true, data: condition };
    } catch (error) {
      return { success: false, error: 'Failed to create condition' };
    }
  }

  /**
   * Delete condition
   */
  async deleteCondition(id: string): Promise<MessageServiceResponse<void>> {
    try {
      const index = this.conditions.findIndex(c => c.id === id);
      if (index === -1) {
        return { success: false, error: 'Condition not found' };
      }
      this.conditions.splice(index, 1);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to delete condition' };
    }
  }
}

// Export singleton instance
export const messageTemplateService = new MessageTemplateService();
