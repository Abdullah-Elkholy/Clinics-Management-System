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
  if (!cond.enabled) return false;
  switch (cond.operator) {
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

function replacePlaceholders(template: string, params: { PN?: string; PQP?: number; ETR?: string; DN?: string; }): string {
  return template
    .replace(/{PN}/g, params.PN ?? '')
    .replace(/{PQP}/g, params.PQP !== undefined ? String(params.PQP) : '')
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

  // sort conditions by priority ascending
  const sorted = [...(config.conditions || [])]
    .filter((c) => c.enabled !== false)
    .sort((a, b) => a.priority - b.priority);

  for (const cond of sorted) {
    if (matchesCondition(offset, cond)) {
      const text = replacePlaceholders(cond.template, {
        PN: patientName,
        PQP: patientPosition,
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

  // No condition matched, apply default if exists
  if (config.defaultTemplate) {
    const text = replacePlaceholders(config.defaultTemplate, {
      PN: patientName,
      PQP: patientPosition,
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
