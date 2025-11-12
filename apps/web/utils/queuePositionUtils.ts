/**
 * Queue Position Utilities
 * Handles calculations and validations for queue positions
 *
 * Key Concepts:
 * - CQP (Current Queue Position): Patient currently in session (reference point)
 * - Patient Position: Absolute position in queue (1, 2, 3, 5, 6, 9, 11...)
 * - Offset: Relative distance from CQP (patient_position - CQP)
 *   - Negative offset: patient is BEFORE CQP
 *   - Zero offset: patient IS AT CQP
 *   - Positive offset: patient is AFTER CQP
 *
 * CRITICAL: Conditions evaluate using RELATIVE OFFSET, not absolute position
 * Patients at position <= CQP are EXCLUDED from messaging and preview
 */

/**
 * Calculate relative offset from CQP
 * @param patientPosition - Patient's queue position (e.g., 5)
 * @param cqp - Current Queue Position (e.g., 3)
 * @returns Relative offset (-999 to +999)
 *
 * @example
 * getRelativePosition(5, 3) // Returns 2
 * getRelativePosition(2, 3) // Returns -1
 * getRelativePosition(3, 3) // Returns 0
 */
export const getRelativePosition = (
  patientPosition: number,
  cqp: number
): number => {
  return patientPosition - cqp;
};

/**
 * Format position for display with CQP context
 * @param position - Patient's position
 * @param cqp - Current Queue Position (optional)
 * @returns Formatted string (e.g., "5 (+2)")
 *
 * @example
 * formatPositionDisplay(5, 3)  // "5 (+2)"
 * formatPositionDisplay(2, 3)  // "2 (-1)"
 * formatPositionDisplay(3, 3)  // "3 (CQP)"
 * formatPositionDisplay(5)     // "5"
 */
export const formatPositionDisplay = (
  position: number,
  cqp?: number
): string => {
  if (cqp === undefined) {
    return String(position);
  }

  const offset = position - cqp;
  if (offset === 0) {
    return `${position} (CQP)`;
  }

  const sign = offset > 0 ? '+' : '';
  return `${position} (${sign}${offset})`;
};

/**
 * Evaluate if patient matches condition
 *
 * CRITICAL: Conditions evaluate using RELATIVE OFFSET from CQP, not absolute position
 * offset = patient_position - CQP
 *
 * @param patientPosition - Patient's queue position
 * @param operator - Comparison operator
 * @param value - Condition value (for equals/greater/less)
 * @param minValue - Minimum for range operator
 * @param maxValue - Maximum for range operator
 * @param cqp - Current Queue Position (reference point for relative calculation)
 * @returns boolean - Whether condition matches
 *
 * @example
 * // Queue: [1, 2, 3, 5, 7, 10, 15], CQP = 3
 * // Patient at position 5:
 * // offset = 5 - 3 = 2
 *
 * // Condition "< 5" means offset < 5
 * matchesCondition(5, 'less', '5', undefined, undefined, 3)
 * // offset 2 < 5? YES ✓
 *
 * // Condition "> 3" means offset > 3
 * matchesCondition(5, 'greater', '3', undefined, undefined, 3)
 * // offset 2 > 3? NO ✗
 */
export const matchesCondition = (
  patientPosition: number,
  operator: 'equals' | 'greater' | 'less' | 'range',
  value?: string,
  minValue?: number,
  maxValue?: number,
  cqp?: number
): boolean => {
  // Step 1: Calculate OFFSET (relative distance from CQP)
  const offset =
    cqp !== undefined ? patientPosition - cqp : patientPosition;

  switch (operator) {
    case 'equals': {
      if (!value) return false;
      const targetOffset = parseInt(value, 10);
      return !isNaN(targetOffset) && offset === targetOffset;
    }

    case 'greater': {
      if (!value) return false;
      const targetOffset = parseInt(value, 10);
      return !isNaN(targetOffset) && offset > targetOffset;
    }

    case 'less': {
      if (!value) return false;
      const targetOffset = parseInt(value, 10);
      return !isNaN(targetOffset) && offset < targetOffset;
    }

    case 'range': {
      const min = minValue ?? 0;
      const max = maxValue ?? 999;
      return offset >= min && offset <= max;
    }

    default:
      return false;
  }
};

/**
 * Check if position is waiting (after CQP)
 * @param patientPosition - Patient's queue position
 * @param cqp - Current Queue Position
 * @returns boolean - True if patient is waiting (after CQP)
 */
export const isWaitingAfterCQP = (
  patientPosition: number,
  cqp: number
): boolean => {
  return patientPosition > cqp;
};

/**
 * Get all positions between CQP and a target position
 * Useful for understanding gap patterns
 *
 * @example
 * getPositionsBetween(3, 9, [1,2,3,5,6,7,9,11]) // Returns [5, 6, 7]
 * getPositionsBetween(5, 11, [1,2,3,5,6,7,9,11]) // Returns [6, 7, 9]
 */
export const getPositionsBetween = (
  cqp: number,
  targetPosition: number,
  allQueuePositions: number[]
): number[] => {
  return allQueuePositions.filter(
    (pos) => pos > cqp && pos < targetPosition
  );
};

/**
 * Describe gap between two positions
 * @example
 * describeGap(3, 5) // "1 empty position (4)"
 * describeGap(7, 9) // "1 empty position (8)"
 * describeGap(3, 4) // "No gap (consecutive)"
 */
export const describeGap = (fromPos: number, toPos: number): string => {
  const gap = toPos - fromPos - 1;

  if (gap === 0) {
    return 'No gap (consecutive)';
  } else if (gap === 1) {
    return `1 empty position (${fromPos + 1})`;
  } else {
    const positions = Array.from(
      { length: gap },
      (_, i) => fromPos + 1 + i
    ).join(', ');
    return `${gap} empty positions (${positions})`;
  }
};

/**
 * Get summary of queue state with offset calculations
 * Useful for logging, debugging, and understanding queue state
 */
export const getQueueSummary = (
  allPositions: number[],
  cqp: number
): {
  totalPositions: number;
  afterCQP: number;
  beforeCQP: number;
  atCQP: boolean;
  gaps: string[];
  offsetRanges: {
    min: number;
    max: number;
  };
} => {
  const sorted = [...allPositions].sort((a, b) => a - b);

  const gaps: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next - current > 1) {
      gaps.push(describeGap(current, next));
    }
  }

  const offsets = sorted.map((p) => p - cqp);
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);

  return {
    totalPositions: sorted.length,
    afterCQP: sorted.filter((p) => p > cqp).length,
    beforeCQP: sorted.filter((p) => p < cqp).length,
    atCQP: sorted.includes(cqp),
    gaps,
    offsetRanges: {
      min: minOffset,
      max: maxOffset,
    },
  };
};

/**
 * Validate condition parameters
 * Returns error message if invalid, null if valid
 *
 * NOTE: Accepts negative offsets (positions before CQP) and positive offsets (after)
 * Example: offset -2 means 2 positions BEFORE CQP
 * Example: offset +5 means 5 positions AFTER CQP
 */
export const validateConditionParams = (
  operator: 'equals' | 'greater' | 'less' | 'range',
  value?: string,
  minValue?: number,
  maxValue?: number
): string | null => {
  if (operator === 'range') {
    if (minValue === undefined || maxValue === undefined) {
      return 'Min and max OFFSET values required for range';
    }
    if (minValue > maxValue) {
      return 'Min offset cannot be greater than max offset';
    }
    // Offset can be negative (before CQP) or positive (after CQP)
    if (minValue < -1000 || maxValue > 1000) {
      return 'Offset values must be between -1000 and 1000';
    }
  } else {
    if (!value || isNaN(parseInt(value, 10))) {
      return 'Valid offset number required';
    }
    const numValue = parseInt(value, 10);
    // Offset can be negative (before CQP) or positive (after CQP)
    if (numValue < -1000 || numValue > 1000) {
      return 'Offset must be between -1000 and 1000';
    }
  }

  return null;
};

/**
 * Type guard for queue positions array
 */
export const isValidQueuePositions = (
  positions: any[]
): positions is number[] => {
  return (
    Array.isArray(positions) &&
    positions.length > 0 &&
    positions.every((p) => Number.isInteger(p) && p > 0 && p <= 10000)
  );
};

/**
 * Get recipients for a message condition
 *
 * CRITICAL FILTERING RULE:
 * 1. Filter patients with position > CQP (waiting, not being served)
 * 2. Apply message condition to filtered list only
 * 3. Return only matching eligible patients
 *
 * Patients at position <= CQP are ALWAYS excluded from messaging
 */
export const getMessageRecipients = (
  allPatients: Array<{ id: string; queue: number; name: string }>,
  cqp: number,
  condition: {
    operator: 'equals' | 'greater' | 'less' | 'range';
    value?: string;
    minValue?: number;
    maxValue?: number;
  }
): Array<{ id: string; queue: number; name: string }> => {
  // Step 1: FILTER - Exclude patients at or before CQP
  const eligiblePatients = allPatients.filter((p) => p.queue > cqp);

  // Step 2: EVALUATE - Apply condition to eligible patients only
  const recipients = eligiblePatients.filter((p) =>
    matchesCondition(
      p.queue,
      condition.operator,
      condition.value,
      condition.minValue,
      condition.maxValue,
      cqp
    )
  );

  // Step 3: RETURN - Only patients who pass both filters
  return recipients;
};

/**
 * Get preview patients for a message condition
 * Uses the same filtering logic as getMessageRecipients
 *
 * This ensures that the preview shows exactly what recipients will be
 * and respects the same business rules about excluding pre-CQP patients
 */
export const getPreviewPatients = (
  allPatients: Array<{ id: string; queue: number; name: string }>,
  cqp: number,
  condition: {
    operator: 'equals' | 'greater' | 'less' | 'range';
    value?: string;
    minValue?: number;
    maxValue?: number;
  }
): Array<{ id: string; queue: number; name: string }> => {
  // Same logic as getMessageRecipients - ensures consistency
  return getMessageRecipients(allPatients, cqp, condition);
};
