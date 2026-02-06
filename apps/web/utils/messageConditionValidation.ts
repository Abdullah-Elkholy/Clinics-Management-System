import { MessageCondition } from '@/types/messageCondition';

/**
 * Validate message conditions for conflicts and issues
 */
export function validateConditions(conditions: MessageCondition[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (conditions.length === 0) {
    return { valid: true, errors, warnings };
  }

  // Check for duplicate priorities
  const priorities = conditions.map(c => c.priority);
  const uniquePriorities = new Set(priorities);
  if (uniquePriorities.size !== priorities.length) {
    errors.push('هناك أولويات مكررة. كل شرط يجب أن يكون له أولوية فريدة');
  }

  // Check for enabled conditions
  const enabledConditions = conditions.filter(c => c.enabled !== false);
  if (enabledConditions.length === 0) {
    warnings.push('جميع الشروط معطلة. لن يتم تطبيق أي شروط');
  }

  // Check for overlapping ranges
  const overlaps = detectRangeOverlaps(conditions);
  if (overlaps.length > 0) {
    overlaps.forEach(overlap => {
      warnings.push(`الشروط "${overlap.cond1.name || 'بدون اسم'}" و "${overlap.cond2.name || 'بدون اسم'}" قد تتداخل`);
    });
  }

  // Check for gaps in ranges
  const gaps = detectRangeGaps(conditions);
  if (gaps.length > 0) {
    gaps.forEach(gap => {
      warnings.push(`هناك فجوة في النطاقات حول الموضع ${gap}`);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detect overlapping ranges
 */
export function detectRangeOverlaps(
  conditions: MessageCondition[]
): Array<{ cond1: MessageCondition; cond2: MessageCondition }> {
  const overlaps: Array<{ cond1: MessageCondition; cond2: MessageCondition }> = [];

  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const c1 = conditions[i];
      const c2 = conditions[j];

      if (conditionsOverlap(c1, c2)) {
        overlaps.push({ cond1: c1, cond2: c2 });
      }
    }
  }

  return overlaps;
}

/**
 * Check if two conditions have overlapping offsets
 */
export function conditionsOverlap(cond1: MessageCondition, cond2: MessageCondition): boolean {
  const range1 = conditionToRange(cond1);
  const range2 = conditionToRange(cond2);

  if (!range1 || !range2) return false;

  // Check if ranges overlap
  return !(range1.max < range2.min || range2.max < range1.min);
}

/**
 * Convert condition to offset range
 */
export function conditionToRange(
  cond: MessageCondition
): { min: number; max: number } | null {
  switch (cond.operator) {
    case 'EQUAL':
      if (cond.value === undefined || cond.value === null) return null;
      return { min: cond.value, max: cond.value };

    case 'GREATER':
      if (cond.value === undefined || cond.value === null) return null;
      return { min: cond.value + 1, max: 999 };

    case 'LESS':
      if (cond.value === undefined || cond.value === null) return null;
      return { min: 1, max: cond.value - 1 };

    case 'RANGE':
      if (cond.minValue === undefined || cond.maxValue === undefined) return null;
      return { min: cond.minValue, max: cond.maxValue };

    default:
      return null;
  }
}

/**
 * Detect gaps in condition ranges (offsets not covered)
 */
export function detectRangeGaps(conditions: MessageCondition[]): number[] {
  const enabledConditions = conditions.filter(c => c.enabled !== false);
  if (enabledConditions.length === 0) return [];

  const ranges = enabledConditions
    .map(c => conditionToRange(c))
    .filter((r): r is { min: number; max: number } => r !== null);

  if (ranges.length === 0) return [];

  const gaps: number[] = [];
  const sortedRanges = ranges.sort((a, b) => a.min - b.min);

  // Check for gap at the beginning
  if (sortedRanges[0].min > 1) {
    gaps.push(1);
  }

  // Check for gaps between ranges
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const currentMax = sortedRanges[i].max;
    const nextMin = sortedRanges[i + 1].min;

    if (nextMin - currentMax > 1) {
      gaps.push(currentMax + 1);
    }
  }

  return gaps;
}

/**
 * Check if all conditions are properly configured
 */
export function isConditionComplete(cond: Partial<MessageCondition>): boolean {
  if (!cond.operator || !cond.template || cond.priority === undefined) {
    return false;
  }

  switch (cond.operator) {
    case 'EQUAL':
    case 'GREATER':
    case 'LESS':
      return cond.value !== undefined && cond.value !== null;

    case 'RANGE':
      return (
        cond.minValue !== undefined &&
        cond.maxValue !== undefined &&
        cond.minValue <= cond.maxValue
      );

    default:
      return false;
  }
}

/**
 * Check template for valid placeholders
 */
export function validateTemplate(template: string): {
  valid: boolean;
  usedPlaceholders: string[];
  invalidPlaceholders: string[];
} {
  const validPlaceholders = new Set(['{PN}', '{PQP}', '{ETR}', '{DN}', '{CN}']);
  const usedPlaceholders: string[] = [];
  const invalidPlaceholders: string[] = [];

  // Find all placeholders in template
  const placeholderRegex = /\{[A-Z]+\}/g;
  const matches = template.match(placeholderRegex) || [];

  for (const match of matches) {
    if (validPlaceholders.has(match)) {
      if (!usedPlaceholders.includes(match)) {
        usedPlaceholders.push(match);
      }
    } else {
      if (!invalidPlaceholders.includes(match)) {
        invalidPlaceholders.push(match);
      }
    }
  }

  return {
    valid: invalidPlaceholders.length === 0,
    usedPlaceholders,
    invalidPlaceholders,
  };
}

/**
 * Get human-readable description of condition
 */
export function getConditionDescription(cond: MessageCondition): string {
  const operatorText = {
    EQUAL: 'يساوي',
    GREATER: 'أكبر من',
    LESS: 'أصغر من',
    RANGE: 'نطاق',
  }[cond.operator];

  const offsetText = cond.operator === 'RANGE'
    ? `${cond.minValue} إلى ${cond.maxValue}`
    : String(cond.value);

  return `موضع الانتظار ${operatorText} ${offsetText}`;
}

/**
 * Calculate how many patients would match a condition (for preview)
 */
export function countMatchingPatients(
  cond: MessageCondition,
  patients: Array<{ queue: number }>,
  currentQueuePosition: number
): number {
  return patients.filter(p => {
    const offset = p.queue - currentQueuePosition;
    if (offset <= 0) return false;

    switch (cond.operator) {
      case 'EQUAL':
        return offset === cond.value;
      case 'GREATER':
        return offset > cond.value!;
      case 'LESS':
        return offset < cond.value!;
      case 'RANGE':
        return offset >= cond.minValue! && offset <= cond.maxValue!;
      default:
        return false;
    }
  }).length;
}

export default {
  validateConditions,
  detectRangeOverlaps,
  conditionsOverlap,
  conditionToRange,
  detectRangeGaps,
  isConditionComplete,
  validateTemplate,
  getConditionDescription,
  countMatchingPatients,
};
