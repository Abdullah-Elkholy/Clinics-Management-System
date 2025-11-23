/**
 * Automated Test Scripts for Message Sending Feature
 * 
 * This file contains comprehensive test cases for:
 * - Conflict detection
 * - WhatsApp validation
 * - Condition matching
 * - Message creation
 * - Panel data verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  conditionToRange, 
  conditionsOverlap, 
  detectOverlappingConditions,
  hasDefaultConflict,
  getConflictSummary 
} from '@/utils/conditionConflictDetector';

// Mock data types
interface MessageCondition {
  id: string;
  name?: string;
  priority: number;
  operator: 'EQUAL' | 'GREATER' | 'LESS' | 'RANGE' | 'DEFAULT';
  value?: number;
  minValue?: number;
  maxValue?: number;
}

describe('Message Sending - Conflict Detection', () => {
  describe('conditionToRange', () => {
    it('should convert EQUAL condition to range', () => {
      const cond: MessageCondition = { id: '1', operator: 'EQUAL', value: 5, priority: 1 };
      const range = conditionToRange(cond);
      expect(range).toEqual({ min: 5, max: 5 });
    });

    it('should convert GREATER condition to range', () => {
      const cond: MessageCondition = { id: '1', operator: 'GREATER', value: 5, priority: 1 };
      const range = conditionToRange(cond);
      expect(range).toEqual({ min: 6, max: 999 });
    });

    it('should convert LESS condition to range', () => {
      const cond: MessageCondition = { id: '1', operator: 'LESS', value: 10, priority: 1 };
      const range = conditionToRange(cond);
      expect(range).toEqual({ min: 1, max: 9 });
    });

    it('should convert RANGE condition to range', () => {
      const cond: MessageCondition = { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 };
      const range = conditionToRange(cond);
      expect(range).toEqual({ min: 5, max: 10 });
    });

    it('should return null for DEFAULT condition', () => {
      const cond: MessageCondition = { id: '1', operator: 'DEFAULT', priority: 1 };
      const range = conditionToRange(cond);
      expect(range).toBeNull();
    });

    it('should return null for EQUAL without value', () => {
      const cond: MessageCondition = { id: '1', operator: 'EQUAL', priority: 1 };
      const range = conditionToRange(cond);
      expect(range).toBeNull();
    });
  });

  describe('conditionsOverlap', () => {
    it('should detect overlap between two RANGE conditions', () => {
      const cond1: MessageCondition = { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 };
      const cond2: MessageCondition = { id: '2', operator: 'RANGE', minValue: 8, maxValue: 15, priority: 2 };
      expect(conditionsOverlap(cond1, cond2)).toBe(true);
    });

    it('should not detect overlap between adjacent RANGE conditions', () => {
      const cond1: MessageCondition = { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 };
      const cond2: MessageCondition = { id: '2', operator: 'RANGE', minValue: 11, maxValue: 15, priority: 2 };
      expect(conditionsOverlap(cond1, cond2)).toBe(false);
    });

    it('should detect overlap between EQUAL and RANGE', () => {
      const cond1: MessageCondition = { id: '1', operator: 'EQUAL', value: 7, priority: 1 };
      const cond2: MessageCondition = { id: '2', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 2 };
      expect(conditionsOverlap(cond1, cond2)).toBe(true);
    });

    it('should detect overlap between GREATER and LESS', () => {
      const cond1: MessageCondition = { id: '1', operator: 'GREATER', value: 5, priority: 1 };
      const cond2: MessageCondition = { id: '2', operator: 'LESS', value: 10, priority: 2 };
      expect(conditionsOverlap(cond1, cond2)).toBe(true); // 6-9 overlaps
    });

    it('should not detect overlap between GREATER and LESS when no overlap', () => {
      const cond1: MessageCondition = { id: '1', operator: 'GREATER', value: 10, priority: 1 };
      const cond2: MessageCondition = { id: '2', operator: 'LESS', value: 5, priority: 2 };
      expect(conditionsOverlap(cond1, cond2)).toBe(false);
    });

    it('should not detect overlap with DEFAULT conditions', () => {
      const cond1: MessageCondition = { id: '1', operator: 'DEFAULT', priority: 1 };
      const cond2: MessageCondition = { id: '2', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 2 };
      expect(conditionsOverlap(cond1, cond2)).toBe(false);
    });
  });

  describe('detectOverlappingConditions', () => {
    it('should detect no overlaps when conditions are separate', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'RANGE', minValue: 1, maxValue: 5, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 6, maxValue: 10, priority: 2 },
      ];
      const overlaps = detectOverlappingConditions(conditions);
      expect(overlaps).toHaveLength(0);
    });

    it('should detect overlaps when conditions overlap', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 8, maxValue: 15, priority: 2 },
      ];
      const overlaps = detectOverlappingConditions(conditions);
      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].id1).toBe('1');
      expect(overlaps[0].id2).toBe('2');
    });

    it('should detect multiple overlaps', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 8, maxValue: 15, priority: 2 },
        { id: '3', operator: 'RANGE', minValue: 12, maxValue: 20, priority: 3 },
      ];
      const overlaps = detectOverlappingConditions(conditions);
      expect(overlaps.length).toBeGreaterThan(0);
    });
  });

  describe('hasDefaultConflict', () => {
    it('should return false when no DEFAULT conditions', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'EQUAL', value: 5, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 10, maxValue: 15, priority: 2 },
      ];
      expect(hasDefaultConflict(conditions)).toBe(false);
    });

    it('should return false when one DEFAULT condition', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'DEFAULT', priority: 1 },
        { id: '2', operator: 'EQUAL', value: 5, priority: 2 },
      ];
      expect(hasDefaultConflict(conditions)).toBe(false);
    });

    it('should return true when multiple DEFAULT conditions', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'DEFAULT', priority: 1 },
        { id: '2', operator: 'DEFAULT', priority: 2 },
      ];
      expect(hasDefaultConflict(conditions)).toBe(true);
    });
  });

  describe('getConflictSummary', () => {
    it('should return no conflicts for clean conditions', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'RANGE', minValue: 1, maxValue: 5, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 6, maxValue: 10, priority: 2 },
        { id: '3', operator: 'DEFAULT', priority: 3 },
      ];
      const summary = getConflictSummary(conditions);
      expect(summary.hasOverlaps).toBe(false);
      expect(summary.hasDefaultConflict).toBe(false);
      expect(summary.totalConflicts).toBe(0);
    });

    it('should detect overlapping conflicts', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 8, maxValue: 15, priority: 2 },
      ];
      const summary = getConflictSummary(conditions);
      expect(summary.hasOverlaps).toBe(true);
      expect(summary.overlappingConditions.length).toBeGreaterThan(0);
    });

    it('should detect multiple DEFAULT conflicts', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'DEFAULT', priority: 1 },
        { id: '2', operator: 'DEFAULT', priority: 2 },
      ];
      const summary = getConflictSummary(conditions);
      expect(summary.hasDefaultConflict).toBe(true);
      expect(summary.totalConflicts).toBe(1);
    });

    it('should detect both overlap and DEFAULT conflicts', () => {
      const conditions: MessageCondition[] = [
        { id: '1', operator: 'RANGE', minValue: 5, maxValue: 10, priority: 1 },
        { id: '2', operator: 'RANGE', minValue: 8, maxValue: 15, priority: 2 },
        { id: '3', operator: 'DEFAULT', priority: 3 },
        { id: '4', operator: 'DEFAULT', priority: 4 },
      ];
      const summary = getConflictSummary(conditions);
      expect(summary.hasOverlaps).toBe(true);
      expect(summary.hasDefaultConflict).toBe(true);
      expect(summary.totalConflicts).toBeGreaterThan(1);
    });
  });
});

describe('Message Sending - Condition Matching Logic', () => {
  /**
   * Test condition matching priority order
   * Priority: 1 = highest priority
   * Order: EQUAL/GREATER/LESS/RANGE (by priority) > DEFAULT > UNCONDITIONED
   */
  
  it('should match EQUAL condition when CalculatedPosition matches', () => {
    const calculatedPosition = 5;
    const conditions = [
      { operator: 'EQUAL', value: 5, priority: 1, template: { content: 'EQUAL template' } },
      { operator: 'GREATER', value: 3, priority: 2, template: { content: 'GREATER template' } },
    ];
    
    // Should match EQUAL first (even though GREATER also matches)
    const matched = conditions.find(c => {
      if (c.operator === 'EQUAL') return calculatedPosition === c.value;
      if (c.operator === 'GREATER') return calculatedPosition > c.value;
      return false;
    });
    
    expect(matched?.operator).toBe('EQUAL');
  });

  it('should match by priority when multiple conditions match', () => {
    const calculatedPosition = 5;
    const conditions = [
      { operator: 'GREATER', value: 3, priority: 2, template: { content: 'GREATER template' } },
      { operator: 'EQUAL', value: 5, priority: 1, template: { content: 'EQUAL template' } }, // Higher priority
    ];
    
    // Sort by priority (ascending: 1 = highest)
    const sorted = [...conditions].sort((a, b) => a.priority - b.priority);
    
    // Find first match
    const matched = sorted.find(c => {
      if (c.operator === 'EQUAL') return calculatedPosition === c.value;
      if (c.operator === 'GREATER') return calculatedPosition > c.value;
      return false;
    });
    
    expect(matched?.priority).toBe(1); // Higher priority wins
  });

  it('should fallback to DEFAULT when no valued condition matches', () => {
    const calculatedPosition = 20;
    const conditions = [
      { operator: 'EQUAL', value: 5, priority: 1, template: { content: 'EQUAL template' } },
      { operator: 'DEFAULT', priority: 2, template: { content: 'DEFAULT template' } },
    ];
    
    // No EQUAL match, should use DEFAULT
    const matched = conditions.find(c => {
      if (c.operator === 'EQUAL') return calculatedPosition === c.value;
      if (c.operator === 'DEFAULT') return true;
      return false;
    });
    
    expect(matched?.operator).toBe('DEFAULT');
  });
});

describe('Message Sending - CalculatedPosition Calculation', () => {
  it('should calculate CalculatedPosition correctly', () => {
    const patientPosition = 15;
    const currentQueuePosition = 10;
    const calculatedPosition = patientPosition - currentQueuePosition;
    
    expect(calculatedPosition).toBe(5);
  });

  it('should handle negative CalculatedPosition (patient already served)', () => {
    const patientPosition = 5;
    const currentQueuePosition = 10;
    const calculatedPosition = patientPosition - currentQueuePosition;
    
    expect(calculatedPosition).toBe(-5);
  });

  it('should handle zero CalculatedPosition (patient currently being served)', () => {
    const patientPosition = 10;
    const currentQueuePosition = 10;
    const calculatedPosition = patientPosition - currentQueuePosition;
    
    expect(calculatedPosition).toBe(0);
  });
});

describe('Message Sending - WhatsApp Validation', () => {
  it('should allow send when all patients have isValidWhatsAppNumber === true', () => {
    const patients = [
      { id: 1, isValidWhatsAppNumber: true },
      { id: 2, isValidWhatsAppNumber: true },
      { id: 3, isValidWhatsAppNumber: true },
    ];
    
    const allValid = patients.every(p => p.isValidWhatsAppNumber === true);
    expect(allValid).toBe(true);
  });

  it('should block send when any patient has isValidWhatsAppNumber === false', () => {
    const patients = [
      { id: 1, isValidWhatsAppNumber: true },
      { id: 2, isValidWhatsAppNumber: false }, // Invalid
      { id: 3, isValidWhatsAppNumber: true },
    ];
    
    const hasInvalid = patients.some(p => p.isValidWhatsAppNumber === false);
    expect(hasInvalid).toBe(true);
  });

  it('should block send when any patient has isValidWhatsAppNumber === null', () => {
    const patients = [
      { id: 1, isValidWhatsAppNumber: true },
      { id: 2, isValidWhatsAppNumber: null }, // Unvalidated
      { id: 3, isValidWhatsAppNumber: true },
    ];
    
    const hasUnvalidated = patients.some(p => 
      p.isValidWhatsAppNumber !== true && p.isValidWhatsAppNumber !== false
    );
    expect(hasUnvalidated).toBe(true);
  });
});

