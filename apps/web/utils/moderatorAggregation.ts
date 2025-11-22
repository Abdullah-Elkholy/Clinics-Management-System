/**
 * Moderator Data Aggregation Utility
 * Groups queues and templates by moderator, computes aggregated stats
 */

import type { Queue, MessageTemplate } from '@/types';
import type { User } from '@/types/user';

export interface ModeratorWithStats {
  moderatorId: string | number;
  moderatorName: string;
  moderatorUsername: string;
  queuesCount: number;
  templatesCount: number;
  conflictCount: number;
  queues: Queue[];
}

export interface QueueWithConflicts extends Queue {
  conflictCount: number;
}

/**
 * Get moderator info by ID from real moderator data
 * Falls back to default values if moderator not found
 * 
 * Handles ID matching for both string and number formats:
 * - Backend sends integer IDs (e.g., 3)
 * - Frontend converts to strings (e.g., "3")
 * - Matching must handle both formats and numeric comparisons
 */
export const getModeratorInfo = (
  moderatorId: string | number,
  moderators?: User[]
): { name: string; username: string } => {
  // If real moderator data is provided, use it
  if (moderators && moderators.length > 0) {
    // Normalize moderatorId to string for comparison
    const normalizedModId = String(moderatorId);
    
    // Try to find moderator by:
    // 1. Exact string match on id
    // 2. Numeric match (convert both to numbers and compare)
    // 3. Username match
    const moderator = moderators.find((m) => {
      const modIdStr = String(m.id);
      const modIdNum = Number(m.id);
      const searchIdNum = Number(moderatorId);
      
      return (
        modIdStr === normalizedModId || // Exact string match
        (!isNaN(modIdNum) && !isNaN(searchIdNum) && modIdNum === searchIdNum) || // Numeric match
        String(m.username) === normalizedModId // Username match
      );
    });
    
    if (moderator) {
      // Use firstName + lastName if both exist, otherwise firstName, otherwise username
      const name = moderator.firstName && moderator.lastName
        ? `${moderator.firstName} ${moderator.lastName}`
        : moderator.firstName || moderator.username || `المشرف #${moderatorId}`;
      
      return {
        name,
        username: moderator.username || `moderator_${moderatorId}`,
      };
    }
  }
  
  // Fallback to default values if moderator not found
  return {
    name: `المشرف #${moderatorId}`,
    username: `moderator_${moderatorId}`,
  };
};

/**
 * Count conflicts in a queue's conditions
 * Replicates the checkConditionIntersections logic from MessagesPanel
 */
export const countConflictsInQueue = (
  queueId: string | number,
  conditions: any[],
  templates: MessageTemplate[]
): number => {
  // Filter conditions for this queue (non-default)
  const queueConditions = conditions.filter(
    (c) => c.queueId === queueId && !c.id.startsWith('DEFAULT_')
  );

  if (queueConditions.length < 2) return 0;

  let conflictCount = 0;

  for (let i = 0; i < queueConditions.length; i++) {
    for (let j = i + 1; j < queueConditions.length; j++) {
      const cond1 = queueConditions[i];
      const cond2 = queueConditions[j];

      // Check if conditions overlap using same logic as MessagesPanel
      if (
        cond1.operator &&
        cond2.operator &&
        getConditionRange(cond1) &&
        getConditionRange(cond2) &&
        conditionsOverlap(cond1, cond2)
      ) {
        conflictCount++;
      }
    }
  }

  return conflictCount;
};

/**
 * Get range representation of a condition
 * Note: All values must be >= 1 (0 and negative values are invalid)
 */
const getConditionRange = (cond: any): { min: number; max: number } | null => {
  switch (cond.operator) {
    case 'EQUAL':
      if (cond.value === undefined || cond.value <= 0) return null;
      return { min: cond.value, max: cond.value };
    case 'GREATER':
      if (cond.value === undefined || cond.value <= 0) return null;
      return { min: cond.value + 1, max: 999 };
    case 'LESS':
      if (cond.value === undefined || cond.value <= 0) return null;
      return { min: 1, max: cond.value - 1 };
    case 'RANGE':
      if (
        cond.minValue === undefined ||
        cond.maxValue === undefined ||
        cond.minValue <= 0 ||
        cond.maxValue <= 0
      )
        return null;
      return { min: cond.minValue, max: cond.maxValue };
    default:
      return null;
  }
};

/**
 * Check if two conditions overlap/intersect
 */
const conditionsOverlap = (cond1: any, cond2: any): boolean => {
  const range1 = getConditionRange(cond1);
  const range2 = getConditionRange(cond2);

  if (!range1 || !range2) return false;

  // Two ranges overlap if NOT (range1.max < range2.min OR range2.max < range1.min)
  return !(range1.max < range2.min || range2.max < range1.min);
};

/**
 * Group queues and templates by moderator
 * Returns array of moderators with aggregated stats
 * 
 * @param queues - Array of queues to group
 * @param templates - Array of message templates
 * @param conditions - Array of message conditions (for conflict detection)
 * @param moderators - Optional array of real moderator data from backend (User[])
 */
export const groupQueuesByModerator = (
  queues: Queue[],
  templates: MessageTemplate[],
  conditions: any[] = [],
  moderators?: User[]
): ModeratorWithStats[] => {
  // Create map of moderator ID to queues and templates
  const moderatorMap = new Map<string | number, ModeratorWithStats>();

  // First, get all unique moderator IDs from queues
  const uniqueModeratorIds = new Set(queues.map((q) => q.moderatorId));

  // Initialize all moderators with zero counts
  Array.from(uniqueModeratorIds).forEach((modId) => {
    const modInfo = getModeratorInfo(modId, moderators);
    moderatorMap.set(modId, {
      moderatorId: modId,
      moderatorName: modInfo.name,
      moderatorUsername: modInfo.username,
      queuesCount: 0,
      templatesCount: 0,
      conflictCount: 0,
      queues: [],
    });
  });

  // Group queues by moderator
  queues.forEach((queue) => {
    const modId = queue.moderatorId;
    const moderatorData = moderatorMap.get(modId);
    if (moderatorData) {
      moderatorData.queuesCount++;
      moderatorData.queues.push(queue);
    }
  });

  // Group templates by moderator (via their queues)
  const templatesByQueueId = new Map<string | number, MessageTemplate[]>();
  templates.forEach((template) => {
    const queueId = template.queueId;
    if (!templatesByQueueId.has(queueId)) {
      templatesByQueueId.set(queueId, []);
    }
    templatesByQueueId.get(queueId)!.push(template);
  });

  // Aggregate template counts and conflicts per moderator
  moderatorMap.forEach((moderatorData) => {
    let totalTemplates = 0;
    let totalConflicts = 0;

    moderatorData.queues.forEach((queue) => {
      const queueTemplates = templatesByQueueId.get(queue.id) || [];
      totalTemplates += queueTemplates.length;

      // Count conflicts for this queue
      const queueConflicts = countConflictsInQueue(queue.id, conditions, []);
      totalConflicts += queueConflicts;
    });

    moderatorData.templatesCount = totalTemplates;
    moderatorData.conflictCount = totalConflicts;
  });

  // Sort by moderator ID and return as array
  return Array.from(moderatorMap.values()).sort(
    (a, b) => Number(a.moderatorId) - Number(b.moderatorId)
  );
};

/**
 * Get templates for a specific queue
 */
export const getQueueTemplates = (
  queueId: string | number,
  templates: MessageTemplate[]
): MessageTemplate[] => {
  return templates.filter((t) => t.queueId === queueId);
};

/**
 * Get all templates for a moderator across all their queues
 */
export const getModeratorTemplates = (
  moderatorId: string | number,
  queues: Queue[],
  templates: MessageTemplate[]
): MessageTemplate[] => {
  const moderatorQueues = queues.filter((q) => q.moderatorId === moderatorId);
  const moderatorQueueIds = new Set(moderatorQueues.map((q) => q.id));
  return templates.filter((t) => moderatorQueueIds.has(t.queueId));
};
