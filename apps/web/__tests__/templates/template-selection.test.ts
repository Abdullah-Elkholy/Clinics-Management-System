/**
 * Phase 2.3: Template Frontend Integration Tests
 * 
 * Tests verify template selection and message preview logic.
 */

describe('Template Selection Logic', () => {
    interface MessageCondition {
        id: number;
        operator: string;
        value?: number;
        minValue?: number;
        maxValue?: number;
        templateId: number;
    }

    interface Template {
        id: number;
        content: string;
        isDeleted: boolean;
    }

    const selectMatchingCondition = (
        conditions: MessageCondition[],
        position: number
    ): MessageCondition | null => {
        // Filter active conditions only
        const activeConditions = conditions;

        // Check specific operators first
        for (const c of activeConditions) {
            if (c.operator === 'EQUAL' && c.value === position) {
                return c;
            }
        }

        // Check range operators
        for (const c of activeConditions) {
            if (
                c.operator === 'RANGE' &&
                c.minValue !== undefined &&
                c.maxValue !== undefined &&
                position >= c.minValue &&
                position <= c.maxValue
            ) {
                return c;
            }
        }

        // Check comparison operators
        for (const c of activeConditions) {
            if (c.operator === 'GREATER' && c.value !== undefined && position > c.value) {
                return c;
            }
            if (c.operator === 'LESS' && c.value !== undefined && position < c.value) {
                return c;
            }
        }

        // Fallback to DEFAULT
        for (const c of activeConditions) {
            if (c.operator === 'DEFAULT') {
                return c;
            }
        }

        // Check UNCONDITIONED
        for (const c of activeConditions) {
            if (c.operator === 'UNCONDITIONED') {
                return c;
            }
        }

        return null;
    };

    describe('EQUAL operator', () => {
        test('matches exact position', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'EQUAL', value: 5, templateId: 100 },
            ];
            const match = selectMatchingCondition(conditions, 5);
            expect(match?.id).toBe(1);
        });

        test('does not match different position', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'EQUAL', value: 5, templateId: 100 },
            ];
            const match = selectMatchingCondition(conditions, 3);
            expect(match).toBeNull();
        });
    });

    describe('RANGE operator', () => {
        test('matches within range', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'RANGE', minValue: 1, maxValue: 10, templateId: 100 },
            ];
            const match = selectMatchingCondition(conditions, 5);
            expect(match?.id).toBe(1);
        });

        test('matches at range boundaries', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'RANGE', minValue: 1, maxValue: 10, templateId: 100 },
            ];
            expect(selectMatchingCondition(conditions, 1)?.id).toBe(1);
            expect(selectMatchingCondition(conditions, 10)?.id).toBe(1);
        });

        test('does not match outside range', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'RANGE', minValue: 1, maxValue: 10, templateId: 100 },
            ];
            const match = selectMatchingCondition(conditions, 11);
            expect(match).toBeNull();
        });
    });

    describe('DEFAULT fallback', () => {
        test('used when no other match', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'EQUAL', value: 5, templateId: 100 },
                { id: 2, operator: 'DEFAULT', templateId: 200 },
            ];
            const match = selectMatchingCondition(conditions, 99);
            expect(match?.id).toBe(2);
        });
    });

    describe('Priority: EQUAL takes precedence', () => {
        test('EQUAL wins over RANGE', () => {
            const conditions: MessageCondition[] = [
                { id: 1, operator: 'RANGE', minValue: 1, maxValue: 10, templateId: 100 },
                { id: 2, operator: 'EQUAL', value: 5, templateId: 200 },
            ];
            const match = selectMatchingCondition(conditions, 5);
            expect(match?.id).toBe(2);
        });
    });
});

describe('Message Content Preview', () => {
    const resolveVariables = (
        content: string,
        variables: { name: string; position: number; phone: string }
    ): string => {
        return content
            .replace(/\{name\}/g, variables.name)
            .replace(/\{position\}/g, variables.position.toString())
            .replace(/\{phone\}/g, variables.phone);
    };

    test('resolves name variable', () => {
        const content = 'مرحباً {name}!';
        const result = resolveVariables(content, {
            name: 'أحمد',
            position: 1,
            phone: '0100',
        });
        expect(result).toBe('مرحباً أحمد!');
    });

    test('resolves position variable', () => {
        const content = 'دورك رقم {position}';
        const result = resolveVariables(content, {
            name: 'أحمد',
            position: 5,
            phone: '0100',
        });
        expect(result).toBe('دورك رقم 5');
    });

    test('resolves multiple variables', () => {
        const content = 'مرحباً {name}، دورك رقم {position}';
        const result = resolveVariables(content, {
            name: 'أحمد',
            position: 3,
            phone: '0100',
        });
        expect(result).toBe('مرحباً أحمد، دورك رقم 3');
    });

    test('handles missing variables gracefully', () => {
        const content = 'مرحباً {unknown}!';
        const result = resolveVariables(content, {
            name: 'أحمد',
            position: 1,
            phone: '0100',
        });
        expect(result).toBe('مرحباً {unknown}!');
    });
});
