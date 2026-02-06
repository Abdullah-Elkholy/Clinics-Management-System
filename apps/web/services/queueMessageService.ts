import { QueueMessageConfig, MessageResolution, MessageCondition } from "../types/messageCondition";

interface ResolveOptions {
  estimatedTimePerSessionMinutes?: number; // ETS
}

function formatTimeDisplay(minutes: number): string {
  const mins = Math.max(0, Math.round(minutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours === 0) return `${rem} دقيقة`;
  if (rem === 0) return `${hours} ساعة`;
  return `${hours} ساعة و ${rem} دقيقة`;
}

function matchesCondition(offset: number, cond: MessageCondition): boolean {
  if (cond.enabled === false) return false;
  
  switch (cond.operator) {
    case 'UNCONDITIONED':
      // UNCONDITIONED always matches (no criteria)
      return true;
    case 'DEFAULT':
      // DEFAULT should not be matched here - it's handled separately as fallback
      // But if it's in the conditions array, it should match when no other condition matches
      return false; // Will be handled as fallback after all conditions are checked
    case 'EQUAL':
      return typeof cond.value === 'number' && offset === cond.value;
    case 'GREATER':
      return typeof cond.value === 'number' && offset > cond.value;
    case 'LESS':
      return typeof cond.value === 'number' && offset < cond.value;
    case 'RANGE':
      return (
        typeof cond.minValue === 'number' &&
        typeof cond.maxValue === 'number' &&
        offset >= cond.minValue &&
        offset <= cond.maxValue
      );
    default:
      return false;
  }
}

/**
 * Replace placeholders in message templates with actual values.
 * Supported variables:
 * - {PN}: Patient Name
 * - {PQP}: Patient Queue Position (the patient's position in the queue)
 * - {CQP}: Current Queue Position (the position currently being served)
 * - {ETR}: Estimated Time Remaining (formatted as "X ساعة و Y دقيقة")
 * - {DN}: Department/Queue Name
 * - {CN}: Clinic/Queue Name
 */
function replacePlaceholders(template: string, params: { PN?: string; PQP?: number; CQP?: number; ETR?: string; DN?: string; CN?: string; }): string {
  return template
    .replace(/{PN}/g, params.PN ?? '')
    .replace(/{PQP}/g, params.PQP !== undefined ? String(params.PQP) : '')
    .replace(/{CQP}/g, params.CQP !== undefined ? String(params.CQP) : '')
    .replace(/{ETR}/g, params.ETR ?? '')
    .replace(/{DN}/g, params.DN ?? '')
    .replace(/{CN}/g, params.CN ?? '');
}

/**
 * Resolve a single patient's message according to the queue config.
 * - Excludes patients with offset < 0 (already served, position < CQP)
 * - Includes patients with offset === 0 (currently being served, position === CQP)
 * - Includes patients with offset > 0 (waiting, position > CQP)
 * - Checks enabled conditions in ascending priority order (1 = highest)
 * - Returns a MessageResolution with reason and resolvedTemplate when applicable
 */
export function resolvePatientMessage(
  config: QueueMessageConfig,
  patientId: string,
  patientName: string | undefined,
  patientPosition: number,
  currentQueuePosition: number,
  options: ResolveOptions = {}
): MessageResolution {
  const offset = patientPosition - currentQueuePosition;
  
  // CRITICAL LOGGING: Log condition matching process
  console.log('[resolvePatientMessage] START:', {
    patientId,
    patientName,
    patientPosition,
    currentQueuePosition,
    offset,
    conditionsCount: config.conditions?.length || 0,
    defaultTemplateExists: !!config.defaultTemplate,
    defaultTemplateLength: config.defaultTemplate?.length || 0,
    defaultTemplatePreview: config.defaultTemplate ? config.defaultTemplate.substring(0, 100) : 'MISSING',
    conditions: config.conditions?.map(c => ({
      id: c.id,
      templateId: c.templateId,
      operator: c.operator,
      value: c.value,
      minValue: c.minValue,
      maxValue: c.maxValue,
      priority: c.priority,
      enabled: c.enabled,
      templateLength: c.template?.length || 0,
      hasTemplate: !!c.template && c.template.trim().length > 0,
      templatePreview: c.template ? c.template.substring(0, 150) : 'EMPTY',
      templateIsEmptyString: c.template === '',
      templateIsUndefined: c.template === undefined,
      templateIsNull: c.template === null,
    })),
  });

  // Only exclude patients with position < CQP (offset < 0)
  // Include patients at CQP (offset === 0) and after CQP (offset > 0)
  if (offset < 0) {
    return {
      patientId,
      patientName,
      patientPosition,
      offset,
      reason: 'EXCLUDED',
    };
  }

  const ets = options.estimatedTimePerSessionMinutes ?? 15;
  // For patients at CQP (offset === 0), ETR should be 0 (they're currently being served)
  // For patients after CQP (offset > 0), calculate ETR normally
  const etrMinutes = offset >= 0 ? offset * ets : 0;
  const etrDisplay = offset === 0 ? '0 دقيقة' : formatTimeDisplay(etrMinutes);

  // Separate conditions into active conditions and DEFAULT condition
  // Filter out deleted conditions and disabled conditions
  const allConditions = [...(config.conditions || [])].filter((c) => 
    c.enabled !== false && 
    !c.isDeleted // Exclude deleted conditions
  );
  const defaultCondition = allConditions.find(c => c.operator === 'DEFAULT');
  const activeConditions = allConditions.filter(c => c.operator !== 'DEFAULT' && c.operator !== 'UNCONDITIONED');
  const unconditionedConditions = allConditions.filter(c => c.operator === 'UNCONDITIONED');
  
  // Sort active conditions by priority ascending (1 = highest priority, checked first)
  const sortedActive = activeConditions.sort((a, b) => a.priority - b.priority);
  
  // Sort UNCONDITIONED conditions by priority (they always match, but priority determines order)
  // NOTE: UNCONDITIONED conditions are checked LAST as absolute fallback, not first
  const sortedUnconditioned = unconditionedConditions.sort((a, b) => a.priority - b.priority);

  // FIRST: Check active conditions (EQUAL, GREATER, LESS, RANGE) - these have specific matching criteria
  for (const cond of sortedActive) {
    const conditionMatches = matchesCondition(offset, cond);
    // CRITICAL: Check for template content (not just truthy - empty string is falsy)
    if (conditionMatches && cond.template && cond.template.trim().length > 0) {
      const text = replacePlaceholders(cond.template, {
        PN: patientName,
        PQP: patientPosition,
        CQP: currentQueuePosition,
        ETR: etrDisplay,
        DN: config.queueName,
        CN: config.queueName,
      });

      console.log('[resolvePatientMessage] ✅ Active condition matched:', {
        conditionId: cond.id,
        operator: cond.operator,
        offset,
        templateLength: cond.template.length,
        resolvedTemplateLength: text.length,
      });

      return {
        patientId,
        patientName,
        patientPosition,
        offset,
        matchedConditionId: cond.id,
        resolvedTemplate: text,
        reason: 'CONDITION',
      };
    } else if (conditionMatches) {
      // Log warning if condition matches but has no template
      console.warn('[resolvePatientMessage] ❌ Condition matched but has no template:', {
        conditionId: cond.id,
        templateId: cond.templateId,
        operator: cond.operator,
        offset,
        hasTemplate: !!cond.template,
        templateLength: cond.template?.length || 0,
        templateValue: cond.template,
        templateIsEmptyString: cond.template === '',
        templateIsUndefined: cond.template === undefined,
      });
    }
  }

  // SECOND: No active condition matched, check DEFAULT condition
  // CRITICAL: Check for template content (not just truthy - empty string is falsy)
  if (defaultCondition && defaultCondition.template && defaultCondition.template.trim().length > 0) {
    const text = replacePlaceholders(defaultCondition.template, {
      PN: patientName,
      PQP: patientPosition,
      CQP: currentQueuePosition,
      ETR: etrDisplay,
      DN: config.queueName,
      CN: config.queueName,
    });
    
    console.log('[resolvePatientMessage] ✅ DEFAULT condition matched:', {
      conditionId: defaultCondition.id,
      templateLength: defaultCondition.template.length,
      resolvedTemplateLength: text.length,
    });
    
    return {
      patientId,
      patientName,
      patientPosition,
      offset,
      matchedConditionId: defaultCondition.id,
      resolvedTemplate: text,
      reason: 'DEFAULT',
    };
  } else if (defaultCondition && process.env.NODE_ENV === 'development') {
    // Log warning if DEFAULT condition has no template
    console.warn('[resolvePatientMessage] DEFAULT condition has no template:', {
      conditionId: defaultCondition.id,
      templateId: defaultCondition.templateId,
      hasTemplate: !!defaultCondition.template,
      templateLength: defaultCondition.template?.length || 0,
    });
  }

  // THIRD: Check UNCONDITIONED conditions as absolute fallback (only if no DEFAULT matched)
  // UNCONDITIONED conditions are checked LAST, not first, to allow active conditions and DEFAULT to take precedence
  for (const cond of sortedUnconditioned) {
    // CRITICAL: Check for template content (not just truthy - empty string is falsy)
    if (cond.template && cond.template.trim().length > 0) {
      const text = replacePlaceholders(cond.template, {
        PN: patientName,
        PQP: patientPosition,
        CQP: currentQueuePosition,
        ETR: etrDisplay,
        DN: config.queueName,
      });

      console.log('[resolvePatientMessage] ✅ UNCONDITIONED matched (fallback):', {
        conditionId: cond.id,
        templateLength: cond.template.length,
        resolvedTemplateLength: text.length,
      });

      return {
        patientId,
        patientName,
        patientPosition,
        offset,
        matchedConditionId: cond.id,
        resolvedTemplate: text,
        reason: 'CONDITION',
      };
    } else {
      // Log warning if UNCONDITIONED condition has no template
      console.warn('[resolvePatientMessage] ❌ UNCONDITIONED condition has no template:', {
        conditionId: cond.id,
        templateId: cond.templateId,
        hasTemplate: !!cond.template,
        templateLength: cond.template?.length || 0,
        templateValue: cond.template,
        templateIsEmptyString: cond.template === '',
        templateIsUndefined: cond.template === undefined,
      });
    }
  }

  // FOURTH: Fallback to config.defaultTemplate if no DEFAULT condition found
  if (config.defaultTemplate) {
    const text = replacePlaceholders(config.defaultTemplate, {
      PN: patientName,
      PQP: patientPosition,
      CQP: currentQueuePosition,
      ETR: etrDisplay,
      DN: config.queueName,
    });
    return {
      patientId,
      patientName,
      patientPosition,
      offset,
      resolvedTemplate: text,
      reason: 'DEFAULT',
    };
  }

  return {
    patientId,
    patientName,
    patientPosition,
    offset,
    reason: 'NO_MATCH',
  };
}

/**
 * Resolve many patients at once. Returns an array of MessageResolution.
 * Preserves input order by default. Useful for MessagePreviewModal.
 */
export function resolvePatientMessages(
  config: QueueMessageConfig,
  patients: Array<{ id: string; name?: string; position: number }>,
  currentQueuePosition: number,
  options: ResolveOptions = {}
): MessageResolution[] {
  return patients.map((p) =>
    resolvePatientMessage(config, p.id, p.name, p.position, currentQueuePosition, options)
  );
}

export default {
  resolvePatientMessage,
  resolvePatientMessages,
};
