/**
 * Condition Conflict Detector
 * 
 * Detects overlapping and conflicting conditions
 * Used in ManageConditionsModal and QueueHeader
 */

export interface MessageCondition {
  id: string;
  name?: string;
  priority: number;
  operator: 'UNCONDITIONED' | 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT';
  value?: number;
  minValue?: number;
  maxValue?: number;
}

interface ValueRange {
  min: number;
  max: number;
}

/**
 * Convert a condition to its numeric range representation
 */
export function conditionToRange(cond: MessageCondition): ValueRange | null {
  switch (cond.operator) {
    case 'EQUAL':
      if (cond.value === undefined) return null;
      return { min: cond.value, max: cond.value };

    case 'GREATER':
      if (cond.value === undefined) return null;
      return { min: cond.value + 1, max: 999 };

    case 'LESS':
      if (cond.value === undefined) return null;
      return { min: 1, max: cond.value - 1 };

    case 'RANGE':
      if (cond.minValue === undefined || cond.maxValue === undefined) return null;
      return { min: cond.minValue, max: cond.maxValue };

    case 'DEFAULT':
      // DEFAULT doesn't have a numeric range, skip overlap check
      return null;

    case 'UNCONDITIONED':
      // UNCONDITIONED doesn't have a numeric range, skip overlap check
      return null;

    default:
      return null;
  }
}

/**
 * Check if two conditions have overlapping value ranges
 */
export function conditionsOverlap(cond1: MessageCondition, cond2: MessageCondition): boolean {
  // Skip DEFAULT conditions from overlap check
  if (cond1.operator === 'DEFAULT' || cond2.operator === 'DEFAULT') {
    return false;
  }

  const range1 = conditionToRange(cond1);
  const range2 = conditionToRange(cond2);

  if (!range1 || !range2) return false;

  // Check if ranges overlap: ranges overlap if NOT (range1.max < range2.min OR range2.max < range1.min)
  return !(range1.max < range2.min || range2.max < range1.min);
}

/**
 * Detect all overlapping condition pairs
 */
export function detectOverlappingConditions(
  conditions: MessageCondition[]
): Array<{ id1: string; id2: string; description: string }> {
  const overlaps: Array<{ id1: string; id2: string; description: string }> = [];

  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const c1 = conditions[i];
      const c2 = conditions[j];

      if (conditionsOverlap(c1, c2)) {
        const desc = `الشرط "${c1.name || `شرط ${i + 1}`}" يتداخل مع "${c2.name || `شرط ${j + 1}`}"`;
        overlaps.push({ id1: c1.id, id2: c2.id, description: desc });
      }
    }
  }

  return overlaps;
}

/**
 * Check if there are any conflicting DEFAULT conditions
 * (Multiple DEFAULT conditions = conflict)
 */
export function hasDefaultConflict(conditions: MessageCondition[]): boolean {
  const defaultCount = conditions.filter((c) => c.operator === 'DEFAULT').length;
  return defaultCount > 1;
}

/**
 * Get all conflicting conditions summary
 */
export function getConflictSummary(conditions: MessageCondition[]): {
  hasOverlaps: boolean;
  hasDefaultConflict: boolean;
  overlappingConditions: Array<{ id1: string; id2: string; description: string }>;
  totalConflicts: number;
} {
  const overlappingConditions = detectOverlappingConditions(conditions);
  const defaultConflict = hasDefaultConflict(conditions);

  return {
    hasOverlaps: overlappingConditions.length > 0,
    hasDefaultConflict: defaultConflict,
    overlappingConditions,
    totalConflicts: overlappingConditions.length + (defaultConflict ? 1 : 0),
  };
}
