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
 */
function replacePlaceholders(template: string, params: { PN?: string; PQP?: number; CQP?: number; ETR?: string; DN?: string; }): string {
  return template
    .replace(/{PN}/g, params.PN ?? '')
    .replace(/{PQP}/g, params.PQP !== undefined ? String(params.PQP) : '')
    .replace(/{CQP}/g, params.CQP !== undefined ? String(params.CQP) : '')
    .replace(/{ETR}/g, params.ETR ?? '')
    .replace(/{DN}/g, params.DN ?? '');
}

/**
 * Resolve a single patient's message according to the queue config.
 * - Excludes patients with offset <= 0 (already served or being served)
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

  if (offset <= 0) {
    return {
      patientId,
      patientName,
      patientPosition,
      offset,
      reason: 'EXCLUDED',
    };
  }

  const ets = options.estimatedTimePerSessionMinutes ?? 15;
  const etrMinutes = offset * ets;
  const etrDisplay = formatTimeDisplay(etrMinutes);

  // Separate conditions into active conditions and DEFAULT condition
  const allConditions = [...(config.conditions || [])].filter((c) => c.enabled !== false);
  const defaultCondition = allConditions.find(c => c.operator === 'DEFAULT');
  const activeConditions = allConditions.filter(c => c.operator !== 'DEFAULT' && c.operator !== 'UNCONDITIONED');
  const unconditionedConditions = allConditions.filter(c => c.operator === 'UNCONDITIONED');
  
  // Sort active conditions by priority ascending (1 = highest priority, checked first)
  const sortedActive = activeConditions.sort((a, b) => a.priority - b.priority);
  
  // Sort UNCONDITIONED conditions by priority (they always match, but priority determines order)
  const sortedUnconditioned = unconditionedConditions.sort((a, b) => a.priority - b.priority);

  // First, check UNCONDITIONED conditions (they always match, highest priority first)
  for (const cond of sortedUnconditioned) {
    if (cond.template) {
      const text = replacePlaceholders(cond.template, {
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
        matchedConditionId: cond.id,
        resolvedTemplate: text,
        reason: 'CONDITION',
      };
    }
  }

  // Then check active conditions (EQUAL, GREATER, LESS, RANGE)
  for (const cond of sortedActive) {
    if (matchesCondition(offset, cond) && cond.template) {
      const text = replacePlaceholders(cond.template, {
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
        matchedConditionId: cond.id,
        resolvedTemplate: text,
        reason: 'CONDITION',
      };
    }
  }

  // No active condition matched, check DEFAULT condition
  if (defaultCondition && defaultCondition.template) {
    const text = replacePlaceholders(defaultCondition.template, {
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
      matchedConditionId: defaultCondition.id,
      resolvedTemplate: text,
      reason: 'DEFAULT',
    };
  }

  // Fallback to config.defaultTemplate if DEFAULT condition not found
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
