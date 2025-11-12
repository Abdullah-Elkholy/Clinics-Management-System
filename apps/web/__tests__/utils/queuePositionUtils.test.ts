/**
 * Unit Tests for queuePositionUtils
 * Tests offset calculations, condition matching, and message recipient filtering
 */

import {
  getRelativePosition,
  formatPositionDisplay,
  matchesCondition,
  isWaitingAfterCQP,
  getPositionsBetween,
  describeGap,
  getQueueSummary,
  validateConditionParams,
  isValidQueuePositions,
  getMessageRecipients,
  getPreviewPatients,
} from '@/utils/queuePositionUtils';

describe('queuePositionUtils', () => {
  /**
   * Test Suite 1: Offset Calculation
   */
  describe('Offset Calculation', () => {
    describe('getRelativePosition', () => {
      it('should calculate correct offset when position > CQP', () => {
        expect(getRelativePosition(5, 3)).toBe(2);
        expect(getRelativePosition(10, 3)).toBe(7);
        expect(getRelativePosition(1, 1)).toBe(0);
      });

      it('should calculate negative offset when position < CQP', () => {
        expect(getRelativePosition(2, 5)).toBe(-3);
        expect(getRelativePosition(1, 10)).toBe(-9);
      });

      it('should handle edge cases', () => {
        expect(getRelativePosition(0, 0)).toBe(0);
        expect(getRelativePosition(100, 50)).toBe(50);
      });
    });

    describe('formatPositionDisplay', () => {
      it('should format position with offset correctly', () => {
        expect(formatPositionDisplay(5, 3)).toBe('5 (+2)');
        expect(formatPositionDisplay(2, 3)).toBe('2 (-1)');
        expect(formatPositionDisplay(3, 3)).toBe('3 (CQP)');
      });

      it('should format position without CQP', () => {
        expect(formatPositionDisplay(5)).toBe('5');
        expect(formatPositionDisplay(10)).toBe('10');
      });

      it('should handle undefined CQP gracefully', () => {
        expect(formatPositionDisplay(5, undefined)).toBe('5');
      });
    });
  });

  /**
   * Test Suite 2: Condition Matching with Offset-based Evaluation
   */
  describe('Condition Matching', () => {
    describe('matchesCondition', () => {
      const cqp = 3; // Reference point

      it('should match equals operator correctly', () => {
        // Position 5, offset +2
        // When checking equals with offset mode (cqp provided), value is the target offset
        expect(matchesCondition(5, 'equals', '2', undefined, undefined, cqp)).toBe(true);
        expect(matchesCondition(5, 'equals', '5', undefined, undefined, cqp)).toBe(false);
        expect(matchesCondition(3, 'equals', '0', undefined, undefined, cqp)).toBe(true);
      });

      it('should match greater operator correctly', () => {
        // offset > 2 means positions > 5
        expect(matchesCondition(6, 'greater', '2', undefined, undefined, cqp)).toBe(true);
        expect(matchesCondition(5, 'greater', '2', undefined, undefined, cqp)).toBe(false);
        expect(matchesCondition(4, 'greater', '2', undefined, undefined, cqp)).toBe(false);
      });

      it('should match less operator correctly', () => {
        // offset < 3 means positions < 6
        expect(matchesCondition(5, 'less', '3', undefined, undefined, cqp)).toBe(true);
        expect(matchesCondition(4, 'less', '3', undefined, undefined, cqp)).toBe(true);
        expect(matchesCondition(6, 'less', '3', undefined, undefined, cqp)).toBe(false);
      });

      it('should match range operator correctly', () => {
        // range 1-3 means offsets 1-3, positions 4-6
        expect(matchesCondition(4, 'range', undefined, 1, 3, cqp)).toBe(true);
        expect(matchesCondition(5, 'range', undefined, 1, 3, cqp)).toBe(true);
        expect(matchesCondition(6, 'range', undefined, 1, 3, cqp)).toBe(true);
        expect(matchesCondition(3, 'range', undefined, 1, 3, cqp)).toBe(false);
        expect(matchesCondition(7, 'range', undefined, 1, 3, cqp)).toBe(false);
      });

      it('should work without CQP (absolute mode)', () => {
        // Without CQP, uses absolute positions
        expect(matchesCondition(5, 'equals', '5')).toBe(true);
        expect(matchesCondition(6, 'greater', '5')).toBe(true);
        expect(matchesCondition(5, 'less', '6')).toBe(true);
      });
    });

    describe('isWaitingAfterCQP', () => {
      it('should correctly identify positions after CQP', () => {
        expect(isWaitingAfterCQP(5, 3)).toBe(true);
        expect(isWaitingAfterCQP(4, 3)).toBe(true);
        expect(isWaitingAfterCQP(3, 3)).toBe(false); // Equal to CQP
        expect(isWaitingAfterCQP(2, 3)).toBe(false); // Before CQP
      });

      it('should handle edge cases', () => {
        expect(isWaitingAfterCQP(1, 1)).toBe(false);
        expect(isWaitingAfterCQP(2, 1)).toBe(true);
        expect(isWaitingAfterCQP(100, 50)).toBe(true);
      });
    });
  });

  /**
   * Test Suite 3: Pre-CQP Exclusion Rule (Critical Business Rule)
   */
  describe('Pre-CQP Exclusion Rule', () => {
    describe('getMessageRecipients', () => {
      const mockPatients = [
        { id: '1', queue: 1, name: 'Patient 1' },
        { id: '2', queue: 2, name: 'Patient 2' },
        { id: '3', queue: 3, name: 'Patient 3' }, // At CQP
        { id: '4', queue: 4, name: 'Patient 4' },
        { id: '5', queue: 5, name: 'Patient 5' },
        { id: '6', queue: 7, name: 'Patient 6' },
      ];

      const cqp = 3;

      it('should exclude patients at or before CQP', () => {
        // Condition: all patients (greater than 0)
        const recipients = getMessageRecipients(
          mockPatients,
          cqp,
          { operator: 'greater' as const, value: '0', minValue: undefined, maxValue: undefined }
        );

        // Only patients with queue > 3 should be included
        expect(recipients.map((p) => p.queue)).toEqual([4, 5, 7]);
        expect(recipients.length).toBe(3);
      });

      it('should enforce pre-CQP exclusion even with matching conditions', () => {
        // Condition: equals to offset 2 (position 5 has offset 2, which is > CQP)
        const recipients = getMessageRecipients(
          mockPatients,
          cqp,
          { operator: 'equals' as const, value: '2', minValue: undefined, maxValue: undefined }
        );

        // Should return 1 patient (position 5 has offset +2)
        // Pre-CQP patients (1,2) and patient at CQP (3) are excluded
        expect(recipients.map((p) => p.queue)).toEqual([5]);
        expect(recipients.length).toBe(1);
      });

      it('should work with range conditions', () => {
        // Condition: range 1-2 (relative offsets)
        // Offsets 1-2 = positions 4-5 (4-3=1, 5-3=2)
        const recipients = getMessageRecipients(
          mockPatients,
          cqp,
          { operator: 'range' as const, value: undefined, minValue: 1, maxValue: 2 }
        );

        // Should include patients at positions 4 and 5
        expect(recipients.map((p) => p.queue)).toEqual([4, 5]);
      });

      it('should return empty list when no patients match', () => {
        // Condition: offset > 10
        const recipients = getMessageRecipients(
          mockPatients,
          cqp,
          { operator: 'greater' as const, value: '10', minValue: undefined, maxValue: undefined }
        );

        expect(recipients.length).toBe(0);
      });

      it('should handle empty patient list', () => {
        const recipients = getMessageRecipients(
          [],
          cqp,
          { operator: 'greater' as const, value: '0', minValue: undefined, maxValue: undefined }
        );

        expect(recipients.length).toBe(0);
      });
    });

    describe('getPreviewPatients', () => {
      const mockPatients = [
        { id: '1', queue: 1, name: 'Patient 1' },
        { id: '2', queue: 3, name: 'Patient 2' }, // At CQP
        { id: '3', queue: 4, name: 'Patient 3' },
        { id: '4', queue: 5, name: 'Patient 4' },
      ];

      const cqp = 3;

      it('should use same filtering as getMessageRecipients', () => {
        const condition = { operator: 'greater' as const, value: '0', minValue: undefined, maxValue: undefined };

        const recipients = getMessageRecipients(mockPatients, cqp, condition);
        const preview = getPreviewPatients(mockPatients, cqp, condition);

        expect(preview.length).toBe(recipients.length);
        expect(preview.map((p) => p.id)).toEqual(recipients.map((p) => p.id));
      });

      it('should enforce same pre-CQP exclusion', () => {
        const condition = { operator: 'equals' as const, value: '0', minValue: undefined, maxValue: undefined };

        const preview = getPreviewPatients(mockPatients, cqp, condition);

        // No patients should be included
        expect(preview.length).toBe(0);
      });
    });
  });

  /**
   * Test Suite 4: Position Analysis
   */
  describe('Position Analysis', () => {
    describe('getPositionsBetween', () => {
      it('should get positions between two queue positions', () => {
        const allPositions = [1, 2, 3, 5, 6, 7, 9, 11];
        expect(getPositionsBetween(3, 7, allPositions)).toEqual([5, 6]);
        expect(getPositionsBetween(1, 9, allPositions)).toEqual([2, 3, 5, 6, 7]);
      });

      it('should return empty when no positions between', () => {
        const allPositions = [1, 3, 5, 7];
        expect(getPositionsBetween(1, 3, allPositions)).toEqual([]);
      });

      it('should handle adjacent positions', () => {
        const allPositions = [1, 2, 3];
        expect(getPositionsBetween(1, 2, allPositions)).toEqual([]);
        expect(getPositionsBetween(1, 3, allPositions)).toEqual([2]);
      });
    });

    describe('describeGap', () => {
      it('should describe gaps between positions', () => {
        expect(describeGap(1, 3)).toBe('1 empty position (2)');
        expect(describeGap(1, 5)).toContain('empty');
      });

      it('should handle adjacent positions', () => {
        const desc = describeGap(1, 2);
        expect(desc).toBeTruthy();
      });
    });

    describe('getQueueSummary', () => {
      it('should generate queue summary', () => {
        const positions = [1, 2, 3, 5, 7];
        const summary = getQueueSummary(positions, 3);

        expect(summary).toBeTruthy();
        expect(typeof summary).toBe('object');
        expect(summary.totalPositions).toBe(5);
        expect(summary.afterCQP).toBeGreaterThanOrEqual(0);
      });

      it('should handle single position', () => {
        const summary = getQueueSummary([5], 3);
        expect(summary).toBeTruthy();
        expect(summary.totalPositions).toBe(1);
      });
    });
  });

  /**
   * Test Suite 5: Validation
   */
  describe('Validation', () => {
    describe('validateConditionParams', () => {
      it('should validate equals operator', () => {
        const result = validateConditionParams('equals', '5');
        expect(result).toBeNull();
      });

      it('should validate range operator', () => {
        const result = validateConditionParams('range', undefined, 1, 5);
        expect(result).toBeNull();
      });

      it('should reject range when min > max', () => {
        const result = validateConditionParams('range', undefined, 5, 1);
        expect(result).not.toBeNull();
        expect(result).toContain('Min offset cannot be greater than max offset');
      });

      it('should detect missing values', () => {
        const result = validateConditionParams('equals');
        expect(result).not.toBeNull();
        expect(result).toContain('Valid offset number required');
      });
    });

    describe('isValidQueuePositions', () => {
      it('should validate queue positions array', () => {
        expect(isValidQueuePositions([1, 2, 3, 5])).toBe(true);
        expect(isValidQueuePositions([5])).toBe(true);
      });

      it('should reject invalid arrays', () => {
        expect(isValidQueuePositions([])).toBe(false);
        expect(isValidQueuePositions([-1, 2, 3])).toBe(false);
      });

      it('should reject non-integer positions', () => {
        expect(isValidQueuePositions([1.5, 2.5])).toBe(false);
      });
    });
  });

  /**
   * Test Suite 6: Integration Scenarios
   */
  describe('Integration Scenarios', () => {
    it('Scenario 1: Busy clinic - multiple conditions with offset logic', () => {
      const patients = [
        { id: '1', queue: 5, name: 'Patient 1' },
        { id: '2', queue: 6, name: 'Patient 2' },
        { id: '3', queue: 8, name: 'Patient 3' },
        { id: '4', queue: 10, name: 'Patient 4' },
      ];

      const cqp = 5; // Clinic is at position 5

      // Condition: Send alerts to patients at offset 1-3 (positions 6-8)
      const recipients = getMessageRecipients(patients, cqp, {
        operator: 'range' as const,
        value: undefined,
        minValue: 1,
        maxValue: 3,
      });

      expect(recipients.map((p) => p.queue)).toEqual([6, 8]);
    });

    it('Scenario 2: Avoid messaging patients at or before current position', () => {
      const patients = [
        { id: '1', queue: 2, name: 'Patient 1' },
        { id: '2', queue: 3, name: 'Patient 2' }, // At CQP
        { id: '3', queue: 4, name: 'Patient 3' },
        { id: '4', queue: 5, name: 'Patient 4' },
      ];

      const cqp = 3;

      // All three condition types should exclude position 2 and 3
      const greaterResult = getMessageRecipients(patients, cqp, {
        operator: 'greater' as const,
        value: '-1',
      });

      const lessResult = getMessageRecipients(patients, cqp, {
        operator: 'less' as const,
        value: '10',
      });

      // Both should exclude positions <= 3
      expect(greaterResult.map((p) => p.queue)).toEqual([4, 5]);
      expect(lessResult.map((p) => p.queue)).toEqual([4, 5]);
    });

    it('Scenario 3: Complex offset ranges across gaps', () => {
      const patients = [
        { id: '1', queue: 1, name: 'P1' },
        { id: '2', queue: 2, name: 'P2' },
        { id: '3', queue: 5, name: 'P3' }, // Gap of 2
        { id: '4', queue: 6, name: 'P4' },
        { id: '5', queue: 9, name: 'P5' }, // Gap of 2
        { id: '6', queue: 10, name: 'P6' },
      ];

      const cqp = 3;

      // Condition: offset 2-5
      const recipients = getMessageRecipients(patients, cqp, {
        operator: 'range' as const,
        value: undefined,
        minValue: 2,
        maxValue: 5,
      });

      // Offsets 2-5 = positions 5-8, so only positions 5 and 6 match
      expect(recipients.map((p) => p.queue)).toEqual([5, 6]);
    });
  });

  /**
   * Test Suite 7: Edge Cases and Error Handling
   */
  describe('Edge Cases and Error Handling', () => {
    it('should handle CQP = 1 (start of queue)', () => {
      const patients = [
        { id: '1', queue: 1, name: 'P1' },
        { id: '2', queue: 2, name: 'P2' },
      ];

      const recipients = getMessageRecipients(patients, 1, {
        operator: 'greater' as const,
        value: '0',
      });

      // Only position 2 is after position 1
      expect(recipients.map((p) => p.queue)).toEqual([2]);
    });

    it('should handle very large queue positions', () => {
      const patients = [
        { id: '1', queue: 1000, name: 'P1' },
        { id: '2', queue: 1001, name: 'P2' },
      ];

      const recipients = getMessageRecipients(patients, 999, {
        operator: 'greater' as const,
        value: '0',
      });

      expect(recipients.length).toBe(2);
    });

    it('should handle unsorted patient list', () => {
      const patients = [
        { id: '3', queue: 5, name: 'P3' },
        { id: '1', queue: 2, name: 'P1' },
        { id: '2', queue: 4, name: 'P2' },
      ];

      const recipients = getMessageRecipients(patients, 3, {
        operator: 'greater' as const,
        value: '0',
      });

      // Should still correctly identify patients > CQP
      expect(recipients.length).toBe(2);
    });
  });
});
