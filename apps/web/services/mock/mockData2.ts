/**
 * Mock Data Fixtures - DEPRECATED
 *
 * This file is deprecated. All data now comes from the backend API.
 * Kept for backward compatibility; returns empty arrays.
 */

import type { TemplateDto, ConditionDto } from '../api/messageApiClient';

/**
 * Empty templates - all data now comes from backend
 */
export const mockTemplatesByQueueId: Record<string, TemplateDto[]> = {};

/**
 * Empty conditions - all data now comes from backend
 */
export const mockConditionsByQueueId: Record<string, ConditionDto[]> = {};

/**
 * Helper to get mock templates - returns empty array (deprecated)
 */
export function getMockTemplates(queueId: number): TemplateDto[] {
  return [];
}

/**
 * Helper to get mock conditions - returns empty array (deprecated)
 */
export function getMockConditions(queueId: number): ConditionDto[] {
  return [];
}
