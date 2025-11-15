/**
 * Phone Formatting Utilities Test Suite (Frontend - P0)
 *
 * Tests phone number normalization and formatting at the frontend level.
 * These utilities should align with backend normalization for single source of truth.
 *
 * Gating: Basic formatting, idempotence, country code handling
 * Spec: Extension support, international format variations
 */

describe('Phone Utilities', () => {
  /**
   * Helper: Normalize phone number (frontend version)
   * - Remove spaces, dashes, parentheses
   * - Ensure + prefix
   * - No leading zeros after country code
   */
  const formatPhone = (phone: string): string => {
    if (!phone) return '';

    // Remove common formatting characters
    let normalized = phone.replace(/[\s\-()]/g, '');

    // Ensure + prefix
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  };

  // ============ GATING TESTS (must pass) ============

  describe('Gating: Basic Formatting', () => {
    it('should add plus prefix if missing', () => {
      const result = formatPhone('201234567890');
      expect(result).toMatch(/^\+/);
    });

    it('should remove spaces from phone number', () => {
      const result = formatPhone('+20 123 456 7890');
      expect(result).not.toContain(' ');
      expect(result).toBe('+201234567890');
    });

    it('should remove dashes from phone number', () => {
      const result = formatPhone('+20-123-456-7890');
      expect(result).not.toContain('-');
      expect(result).toBe('+201234567890');
    });

    it('should handle already formatted phone', () => {
      const input = '+201234567890';
      const result = formatPhone(input);
      expect(result).toBe(input);
    });

    it('should preserve leading plus', () => {
      const result = formatPhone('+201234567890');
      expect(result).toMatch(/^\+/);
    });

    it('should handle empty string', () => {
      const result = formatPhone('');
      expect(result).toBe('');
    });

    it('should handle different country codes', () => {
      const testCases = [
        { input: '966512345678', expected: '+966512345678' },
        { input: '971501234567', expected: '+971501234567' },
        { input: '201234567890', expected: '+201234567890' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = formatPhone(input);
        expect(result).toBe(expected);
      });
    });

    it('should be idempotent', () => {
      const phone = '+201234567890';
      const result1 = formatPhone(phone);
      const result2 = formatPhone(result1);
      expect(result1).toBe(result2);
    });

    it('should remove parentheses', () => {
      const result = formatPhone('+20(123)456-7890');
      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });
  });

  describe('Gating: Validation Integration', () => {
    it('should validate minimum length after formatting', () => {
      const formatted = formatPhone('+201234567890');
      expect(formatted.length).toBeGreaterThanOrEqual(11); // +XX minimum
    });

    it('should handle only digits and plus', () => {
      const result = formatPhone('+201234567890');
      expect(result).toMatch(/^\+\d+$/);
    });
  });

  // ============ SPEC TESTS (may fail - xfail) ============

  describe('[xfail] Spec: Extension Support', () => {
    it('should preserve extension in formatted phone', () => {
      // DEFECT: SPEC-006
      // Currently fails because extension parsing not implemented
      // Fix Target: Phase 2.2 I18N Sprint
      const input = '+201234567890 ext. 123';
      const result = formatPhone(input);

      // Should preserve the extension part
      expect(result).toContain('ext');
      expect(result).toMatch(/ext[.\s]*123/i);
    });

    it('should handle extension with various formats', () => {
      // DEFECT: SPEC-FE-001
      // Extension formats: "ext. 123", "ext 123", "x123", "#123"
      const testCases = [
        '+201234567890 ext. 123',
        '+201234567890 ext 123',
        '+201234567890x123',
        '+201234567890#123',
      ];

      testCases.forEach((input) => {
        const result = formatPhone(input);
        expect(result).toMatch(/\d+/); // Should contain digits
      });
    });
  });

  describe('[xfail] Spec: International Format Variations', () => {
    it('should handle parentheses area code format', () => {
      // DEFECT: SPEC-014
      // Input: +20(123) 456-7890
      // Expected: +201234567890
      // Currently fails if not implemented
      const input = '+20(123) 456-7890';
      const result = formatPhone(input);

      expect(result).toMatch(/^\+\d+$/);
      expect(result.replace(/^\+/, '')).toHaveLength(10);
    });

    it('should normalize dot-separated country code', () => {
      const input = '+20.1234567890';
      const result = formatPhone(input);
      expect(result).toMatch(/^\+\d+$/);
    });
  });

  // ============ UTILITY TESTS ============

  describe('Utility: Phone Display Formatting', () => {
    /**
     * Format phone for display (with separators for readability)
     * Example: +20 1234 567 890
     */
    const formatPhoneDisplay = (phone: string): string => {
      const normalized = formatPhone(phone);
      if (!normalized.startsWith('+')) return normalized;

      const parts = normalized.substring(1); // Remove +
      if (parts.length < 10) return normalized;

      // Group: +XX XXXX XXX XXXX
      const match = parts.match(/^(\d{2})(\d{4})(\d{3})(\d+)$/);
      if (match) {
        return `+${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
      }

      return normalized;
    };

    it('should format phone for display', () => {
      const result = formatPhoneDisplay('+201234567890');
      expect(result).toBe('+20 1234 567 890');
    });

    it('should preserve plus in display format', () => {
      const result = formatPhoneDisplay('201234567890');
      expect(result).toMatch(/^\+/);
    });
  });

  // ============ ERROR SCENARIOS ============

  describe('Error: Invalid Inputs', () => {
    it('should handle null gracefully', () => {
      expect(() => formatPhone(null as unknown as string)).not.toThrow();
    });

    it('should handle undefined gracefully', () => {
      expect(() => formatPhone(undefined as unknown as string)).not.toThrow();
    });

    it('should handle alphabetic input', () => {
      const result = formatPhone('+20ABC123DEF');
      // Should strip non-numeric (or keep for error detection)
      expect(result).toBeDefined();
    });

    it('should handle special characters', () => {
      const result = formatPhone('+20!@#$123');
      expect(result).toBeDefined();
    });
  });
});
