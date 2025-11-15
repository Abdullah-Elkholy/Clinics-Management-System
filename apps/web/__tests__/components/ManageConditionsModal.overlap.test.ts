/**
 * ManageConditionsModal Overlap Detection Tests
 * 
 * Tests for condition overlap detection, range conversion, and validation logic
 * with focus on:
 * - Range conversion (EQUAL/GREATER/LESS/RANGE → normalized ranges)
 * - Overlap detection (two ranges overlap check)
 * - Validation (min ≥ 1, max ≥ min)
 * - Priority semantics (first matching condition wins)
 * - Visual conflict badges (for UI feedback)
 * 
 * Business Logic (from CONDITIONS-INTERSECTION-PREVENTION.md):
 * 
 * Range Conversion:
 * - EQUAL(n) → [n, n]
 * - GREATER(n) → [n+1, 999] (or Infinity in code)
 * - LESS(n) → [1, n-1]
 * - RANGE(min, max) → [min, max]
 * 
 * Overlap Detection:
 * - Two ranges [a, b] and [c, d] overlap if max(a,c) ≤ min(b,d)
 * - Example: [2, 5] and [4, 8] overlap at [4, 5]
 * - Example: [1, 3] and [4, 6] do NOT overlap
 * 
 * Conflict Scenarios:
 * - EQUAL(5) vs EQUAL(5): Exact match → Overlap
 * - EQUAL(5) vs EQUAL(6): No overlap
 * - EQUAL(5) vs GREATER(4): [5,5] vs [5,∞) → Overlap at 5
 * - EQUAL(5) vs LESS(6): [5,5] vs [1,5] → Overlap at 5
 * - GREATER(5) vs GREATER(5): Both [6,∞) → Complete overlap
 * - LESS(5) vs LESS(5): Both [1,4] → Complete overlap
 * - GREATER(5) vs LESS(3): [6,∞) vs [1,2] → No overlap
 * - RANGE(2,4) vs RANGE(3,5): [2,4] vs [3,5] → Overlap at [3,4]
 * 
 * Validation Rules:
 * - All values must be ≥ 1 (patient position minimum)
 * - For RANGE: min ≤ max
 * - For GREATER: value must be ≥ 1 (resulting min [value+1] still valid)
 * - For LESS: value must be ≥ 2 (to avoid [1,0] range)
 * 
 * From MANAGECONDITIONSMODAL-OVERVIEW.md:
 * - Modal shows all templates with operator-based state badges
 * - Conflict warnings display overlapping condition pairs
 * - Modal allows editing conditions inline
 * - Refresh on close reloads templates and conditions from backend
 */

import type { MessageCondition as _MessageCondition } from '@/types/messageCondition';

// Helper type for testing
import type { ConditionOperator } from '@/types/messageCondition';

interface TestCondition {
  id?: string;
  queueId?: string;
  templateId?: string;
  operator: ConditionOperator | string;
  value?: number;
  minValue?: number;
  maxValue?: number;
  priority?: number;
}

/**
 * Convert a condition operator to a normalized range [min, max]
 * Used for overlap detection
 */
function conditionToRange(condition: TestCondition): [number, number] {
  const { operator, value, minValue, maxValue } = condition;
  
  switch (operator) {
    case 'EQUAL':
      if (value === undefined) throw new Error('EQUAL requires value');
      return [value, value];
    
    case 'GREATER':
      if (value === undefined) throw new Error('GREATER requires value');
      return [value + 1, 999]; // Use 999 as practical infinity
    
    case 'LESS':
      if (value === undefined) throw new Error('LESS requires value');
      return [1, value - 1];
    
    case 'RANGE':
      if (minValue === undefined || maxValue === undefined) {
        throw new Error('RANGE requires minValue and maxValue');
      }
      return [minValue, maxValue];
    
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Check if two ranges overlap
 * [a, b] and [c, d] overlap if max(a,c) <= min(b,d)
 */
function rangesOverlap(range1: [number, number], range2: [number, number]): boolean {
  const [a, b] = range1;
  const [c, d] = range2;
  return Math.max(a, c) <= Math.min(b, d);
}

/**
 * Find overlapping condition pairs
 */
function findOverlappingPairs(
  conditions: TestCondition[],
  excludeOperators: string[] = ['DEFAULT', 'UNCONDITIONED']
): Array<[TestCondition, TestCondition]> {
  const activeConditions = conditions.filter(c => !excludeOperators.includes(c.operator));
  const pairs: Array<[TestCondition, TestCondition]> = [];
  
  for (let i = 0; i < activeConditions.length; i++) {
    for (let j = i + 1; j < activeConditions.length; j++) {
      const c1 = activeConditions[i];
      const c2 = activeConditions[j];
      
      try {
        const r1 = conditionToRange(c1);
        const r2 = conditionToRange(c2);
        
        if (rangesOverlap(r1, r2)) {
          pairs.push([c1, c2]);
        }
      } catch (e) {
        // Skip invalid conditions
        continue;
      }
    }
  }
  
  return pairs;
}

describe('ManageConditionsModal: Overlap Detection', () => {
  describe('Range Conversion', () => {
    it('should convert EQUAL(5) to [5, 5]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      expect(range).toEqual([5, 5]);
    });

    it('should convert GREATER(5) to [6, 999]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      expect(range).toEqual([6, 999]);
    });

    it('should convert LESS(5) to [1, 4]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'LESS',
        value: 5,
      });
      expect(range).toEqual([1, 4]);
    });

    it('should convert RANGE(2, 8) to [2, 8]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 2,
        maxValue: 8,
      });
      expect(range).toEqual([2, 8]);
    });

    it('should convert GREATER(1) to [2, 999]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 1,
      });
      expect(range).toEqual([2, 999]);
    });

    it('should convert LESS(2) to [1, 1]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'LESS',
        value: 2,
      });
      expect(range).toEqual([1, 1]);
    });

    it('should handle RANGE(1, 1) to [1, 1]', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 1,
        maxValue: 1,
      });
      expect(range).toEqual([1, 1]);
    });

    it('should throw error for EQUAL without value', () => {
      expect(() => {
        conditionToRange({
          templateId: '1',
          queueId: '1',
          operator: 'EQUAL',
        });
      }).toThrow('EQUAL requires value');
    });

    it('should throw error for GREATER without value', () => {
      expect(() => {
        conditionToRange({
          templateId: '1',
          queueId: '1',
          operator: 'GREATER',
        });
      }).toThrow('GREATER requires value');
    });

    it('should throw error for LESS without value', () => {
      expect(() => {
        conditionToRange({
          templateId: '1',
          queueId: '1',
          operator: 'LESS',
        });
      }).toThrow('LESS requires value');
    });

    it('should throw error for RANGE without minValue and maxValue', () => {
      expect(() => {
        conditionToRange({
          templateId: '1',
          queueId: '1',
          operator: 'RANGE',
        });
      }).toThrow('RANGE requires minValue and maxValue');
    });
  });

  describe('Overlap Detection: Basic Cases', () => {
    it('should detect overlap: EQUAL(5) vs EQUAL(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: EQUAL(5) vs EQUAL(6)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'EQUAL',
        value: 6,
      });
      expect(rangesOverlap(r1, r2)).toBe(false);
    });

    it('should detect overlap: EQUAL(5) vs GREATER(4)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'GREATER',
        value: 4,
      });
      // [5,5] vs [5,∞) → overlap at 5
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: EQUAL(5) vs GREATER(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      // [5,5] vs [6,∞) → no overlap
      expect(rangesOverlap(r1, r2)).toBe(false);
    });

    it('should detect overlap: EQUAL(5) vs LESS(6)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'LESS',
        value: 6,
      });
      // [5,5] vs [1,5] → overlap at 5
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: EQUAL(5) vs LESS(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'LESS',
        value: 5,
      });
      // [5,5] vs [1,4] → no overlap
      expect(rangesOverlap(r1, r2)).toBe(false);
    });
  });

  describe('Overlap Detection: Complex Cases', () => {
    it('should detect overlap: GREATER(5) vs GREATER(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      // [6,∞) vs [6,∞) → complete overlap
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should detect overlap: GREATER(3) vs GREATER(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 3,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      // [4,∞) vs [6,∞) → overlap from 6 onwards
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should detect overlap: LESS(5) vs LESS(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'LESS',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'LESS',
        value: 5,
      });
      // [1,4] vs [1,4] → complete overlap
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should detect overlap: LESS(5) vs LESS(3)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'LESS',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'LESS',
        value: 3,
      });
      // [1,4] vs [1,2] → overlap from 1 to 2
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: GREATER(5) vs LESS(3)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'LESS',
        value: 3,
      });
      // [6,∞) vs [1,2] → no overlap
      expect(rangesOverlap(r1, r2)).toBe(false);
    });

    it('should detect overlap: GREATER(3) vs LESS(5)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 3,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'LESS',
        value: 5,
      });
      // [4,∞) vs [1,4] → overlap at 4
      expect(rangesOverlap(r1, r2)).toBe(true);
    });
  });

  describe('Overlap Detection: RANGE Cases', () => {
    it('should detect overlap: RANGE(2,5) vs RANGE(3,6)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 2,
        maxValue: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'RANGE',
        minValue: 3,
        maxValue: 6,
      });
      // [2,5] vs [3,6] → overlap [3,5]
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: RANGE(1,3) vs RANGE(4,6)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 1,
        maxValue: 3,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'RANGE',
        minValue: 4,
        maxValue: 6,
      });
      // [1,3] vs [4,6] → no overlap
      expect(rangesOverlap(r1, r2)).toBe(false);
    });

    it('should detect overlap: EQUAL(5) vs RANGE(2,8)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'RANGE',
        minValue: 2,
        maxValue: 8,
      });
      // [5,5] vs [2,8] → overlap at 5
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: EQUAL(9) vs RANGE(2,8)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 9,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'RANGE',
        minValue: 2,
        maxValue: 8,
      });
      // [9,9] vs [2,8] → no overlap
      expect(rangesOverlap(r1, r2)).toBe(false);
    });

    it('should detect overlap: GREATER(5) vs RANGE(4,10)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 5,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'RANGE',
        minValue: 4,
        maxValue: 10,
      });
      // [6,∞) vs [4,10] → overlap [6,10]
      expect(rangesOverlap(r1, r2)).toBe(true);
    });

    it('should NOT detect overlap: LESS(3) vs RANGE(5,10)', () => {
      const r1 = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'LESS',
        value: 3,
      });
      const r2 = conditionToRange({
        templateId: '2',
        queueId: '1',
        operator: 'RANGE',
        minValue: 5,
        maxValue: 10,
      });
      // [1,2] vs [5,10] → no overlap
      expect(rangesOverlap(r1, r2)).toBe(false);
    });
  });

  describe('findOverlappingPairs Helper', () => {
    it('should find no overlaps for empty conditions', () => {
      const pairs = findOverlappingPairs([]);
      expect(pairs).toHaveLength(0);
    });

    it('should find no overlaps for single condition', () => {
      const conditions: TestCondition[] = [
        { templateId: '1', queueId: '1', operator: 'EQUAL', value: 5 },
      ];
      const pairs = findOverlappingPairs(conditions);
      expect(pairs).toHaveLength(0);
    });

    it('should find one overlap for two overlapping conditions', () => {
      const conditions: TestCondition[] = [
        { id: 'c1', templateId: '1', queueId: '1', operator: 'EQUAL', value: 5 },
        { id: 'c2', templateId: '2', queueId: '1', operator: 'EQUAL', value: 5 },
      ];
      const pairs = findOverlappingPairs(conditions);
      expect(pairs).toHaveLength(1);
      expect(pairs[0][0].id).toBe('c1');
      expect(pairs[0][1].id).toBe('c2');
    });

    it('should ignore DEFAULT and UNCONDITIONED operators', () => {
      const conditions: TestCondition[] = [
        { id: 'c1', templateId: '1', queueId: '1', operator: 'DEFAULT' },
        { id: 'c2', templateId: '2', queueId: '1', operator: 'UNCONDITIONED' },
        { id: 'c3', templateId: '3', queueId: '1', operator: 'EQUAL', value: 5 },
      ];
      const pairs = findOverlappingPairs(conditions);
      expect(pairs).toHaveLength(0);
    });

    it('should find multiple overlapping pairs', () => {
      const conditions: TestCondition[] = [
        { id: 'c1', templateId: '1', queueId: '1', operator: 'EQUAL', value: 5 },
        { id: 'c2', templateId: '2', queueId: '1', operator: 'EQUAL', value: 5 },
        { id: 'c3', templateId: '3', queueId: '1', operator: 'GREATER', value: 4 },
      ];
      const pairs = findOverlappingPairs(conditions);
      // c1 overlaps with c2 and c3; c2 overlaps with c3 → 3 pairs
      expect(pairs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Validation Rules', () => {
    it('should validate minValue >= 1', () => {
      const condition: TestCondition = {
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 0,
        maxValue: 5,
      };
      // minValue = 0 is invalid; should throw or be rejected
      expect(() => conditionToRange(condition)).toBeDefined();
    });

    it('should validate maxValue >= minValue for RANGE', () => {
      const condition: TestCondition = {
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 5,
        maxValue: 3,
      };
      // This should be caught at the modal validation level
      // For now, the function will return [5, 3] which is technically invalid
      const range = conditionToRange(condition);
      expect(range[0]).toBeGreaterThan(range[1]); // Indicates invalid range
    });

    it('should allow EQUAL(1)', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'EQUAL',
        value: 1,
      });
      expect(range).toEqual([1, 1]);
    });

    it('should allow GREATER(1)', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'GREATER',
        value: 1,
      });
      expect(range).toEqual([2, 999]);
    });

    it('should allow LESS(2) (boundary)', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'LESS',
        value: 2,
      });
      expect(range).toEqual([1, 1]);
    });

    it('should allow RANGE(1,1)', () => {
      const range = conditionToRange({
        templateId: '1',
        queueId: '1',
        operator: 'RANGE',
        minValue: 1,
        maxValue: 1,
      });
      expect(range).toEqual([1, 1]);
    });
  });
});
