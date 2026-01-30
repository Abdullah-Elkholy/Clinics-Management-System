'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQueue } from '@/contexts/QueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useSelectDialog } from '@/contexts/SelectDialogContext';
import { useSignalR as useSignalRContext } from '@/contexts/SignalRContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { messageApiClient, type MyQuotaDto } from '@/services/api/messageApiClient';
import ModeratorMessagesOverview from './ModeratorMessagesOverview';
import { UserRole } from '@/types/roles';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/state';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { ConflictBadge } from '@/components/Common/ConflictBadge';
import { formatLocalDate, formatLocalDateTime, parseAsUtc } from '@/utils/dateTimeUtils';
import logger from '@/utils/logger';
import type { MessageCondition } from '@/types/messageCondition';
import { useUserManagement } from '@/hooks/useUserManagement';
import { getConditionRange, conditionsOverlap } from '@/utils/moderatorAggregation';

/**
 * Minimal Messages Panel - Focused on Queue Template Management
 * Features:
 * - Collapsible queue sections
 * - Per-queue template management
 * - Search/filter/sort across all queues
 * - Bulk operations per queue
 * - Category badges
 * - Statistics per queue
 */

const USAGE_GUIDE_ITEMS = [
  {
    title: 'البحث والترتيب',
    description: 'ابحث عن القوالب بسهولة حسب العنوان أو الوصف، والقوالب مرتبة أبجدياً تلقائياً'
  },
  {
    title: 'توسيع/طي',
    description: 'استخدم زر "توسيع الكل" أو "طي الكل" لإدارة جميع العيادات بسرعة'
  },
  {
    title: 'القالب الافتراضي',
    description: 'يجب أن يكون هناك قالب واحد بدون شروط (لم يتم تحديده بعد) لكل عيادة، وهو يُستخدم عند عدم توفر شروط أخرى'
  },
  {
    title: 'الشروط',
    description: 'استخدم الشروط لإرسال رسائل مختلفة بناءً على معايير محددة (مثل: أكثر من 5 دقائق انتظار)'
  },
  {
    title: 'الحذف الآمن',
    description: 'عند حذف القالب الافتراضي، تحتاج لتحديد قالب افتراضي جديد أولاً. القوالب الأخرى تُحذف بتأكيد بسيط'
  },
  {
    title: 'التحرير والإنشاء',
    description: 'اضغط "تحرير" لتعديل قالب موجود، أو "إضافة قالب جديد" لإنشاء واحد جديد'
  },
  {
    title: 'المتغيرات',
    description: 'استخدم المتغيرات مثل {PN} (اسم المريض)، {CQP} (الموضع الحالي) لتخصيص الرسائل'
  },
];

export default function MessagesPanel() {
  const { selectedQueueId: _selectedQueueId, queues, messageTemplates, messageConditions, refreshQueueData } = useQueue();
  const { user } = useAuth();
  const { addToast, setCurrentPanel, setSelectedQueueId } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { select: _select } = useSelectDialog();
  const [userManagementState, userManagementActions] = useUserManagement();

  /**
   * Role-based rendering:
   * - PrimaryAdmin or SecondaryAdmin: Show ModeratorMessagesOverview (moderator-centric view)
   * - Moderator: Show existing queue-based layout (their own queues)
   * - User: Show queue-based layout filtered to their assigned moderator's queues
   */
  const isAdminView = user && (user.role === UserRole.PrimaryAdmin || user.role === UserRole.SecondaryAdmin);

  /**
   * Filter queues based on user role:
   * - User role: Only see queues where ModeratorId == user.assignedModerator
   * - Moderator role: Default behavior (already filtered by backend)
   */
  const filteredQueues = useMemo(() => {
    if (!user) return queues;

    if (user.role === UserRole.User) {
      // Users see only queues where ModeratorId == user.assignedModerator
      if (!user.assignedModerator) return [];
      const moderatorId = user.assignedModerator.toString();
      return queues.filter(q => {
        const qModId = q.moderatorId?.toString();
        return qModId === moderatorId;
      });
    }

    // Moderators and other roles see queues as-is (filtered by backend)
    return queues;
  }, [queues, user]);

  // State for search, filtering, sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQueues, setExpandedQueues] = useState<Set<string | number>>(new Set());
  const [_selectedConditionFilter, _setSelectedConditionFilter] = useState<string | null>(null);
  const [highlightedConditionType, _setHighlightedConditionType] = useState<string | null>(null);
  const [userQuota, setUserQuota] = useState<MyQuotaDto | null>(null);
  const [_isLoadingQuota, setIsLoadingQuota] = useState(false);

  /**
   * Load user's quota and user data from API on component mount
   */
  useEffect(() => {
    const loadQuota = async () => {
      try {
        setIsLoadingQuota(true);
        const quota = await messageApiClient.getMyQuota();
        setUserQuota(quota);
      } catch (err) {
        // Fallback to mock data on error
        setUserQuota(null);
      } finally {
        setIsLoadingQuota(false);
      }
    };

    loadQuota();

    // Fetch users and moderators to populate userManagementState for getUserDisplayName
    if (user && (user.role === UserRole.PrimaryAdmin || user.role === UserRole.SecondaryAdmin || user.role === UserRole.Moderator)) {
      userManagementActions.fetchUsers();
      userManagementActions.fetchModerators();
    }
  }, [user]); // Only depend on user, not userManagementActions to prevent infinite loops

  /**
   * Listen for data updates and refetch queue data
   * FIXED: Prevents infinite loop by using stable queue IDs and refs
   * See: PERFORMANCE_RESEARCH_AND_CDC_ANALYSIS.md Section 14.3.2
   */
  // Stable queue IDs to prevent effect re-runs when queue array reference changes
  // Compute IDs string and use a ref to track previous value for comparison
  const queueIdsRef = useRef<string>('');
  const queueIds = useMemo(() => {
    // Compute sorted IDs string
    const sortedIds = [...queues]
      .map(q => String(q.id))
      .sort((a, b) => a.localeCompare(b));
    const idsString = sortedIds.join(',');

    // Only return new value if IDs actually changed (value comparison, not reference)
    if (idsString !== queueIdsRef.current) {
      queueIdsRef.current = idsString;
    }

    return queueIdsRef.current;
  }, [
    // Depend on length and a stable representation of the IDs
    // The sorted/joined string will be the same if IDs are the same, even if computed multiple times
    queues.length,
    // Create a stable string by sorting and joining - this creates a new string each time,
    // but useMemo will only trigger effects when the actual value changes (React compares by value for strings)
    queues.map(q => String(q.id)).sort((a, b) => a.localeCompare(b)).join(',')
  ]);

  // Refs for preventing concurrent refreshes and rapid successive calls
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef<Map<string, number>>(new Map());
  const refreshQueueDataRef = useRef(refreshQueueData);
  // Track which queues are currently being loaded to prevent duplicate requests
  const loadingQueuesRef = useRef<Set<string>>(new Set());

  // Keep ref updated
  useEffect(() => {
    refreshQueueDataRef.current = refreshQueueData;
  }, [refreshQueueData]);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    let lastThrottleTime = 0;
    const DEBOUNCE_MS = 2000; // Increased from 1000ms to 2000ms for better batching
    const THROTTLE_MS = 10000; // Increased from 5s to 10s - max once per 10 seconds
    const MIN_REFRESH_INTERVAL_MS = 5000; // Increased from 2s to 5s - min 5 seconds between same queue refreshes

    const handleDataUpdate = async (event?: Event) => {
      // Debounce: wait before executing to batch multiple rapid events
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        // Throttle: prevent execution if called too frequently
        const now = Date.now();
        if (now - lastThrottleTime < THROTTLE_MS) {
          logger.debug('MessagesPanel: Throttled refresh (too soon after last refresh)');
          return;
        }
        lastThrottleTime = now;

        // Prevent concurrent refreshes
        if (isRefreshingRef.current) {
          logger.debug('MessagesPanel: Skipping refresh (already in progress)');
          return;
        }

        isRefreshingRef.current = true;

        try {
          // Extract queueId from event detail if available (for targeted refresh)
          const queueIdFromEvent = (event as CustomEvent)?.detail?.queueId;
          const queueIdsArray = queueIds.split(',').filter(Boolean);

          if (queueIdFromEvent) {
            // Targeted refresh: only refresh the specific queue that changed
            const queueId = String(queueIdFromEvent);
            const lastRefreshTime = lastRefreshTimeRef.current.get(queueId) || 0;

            if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
              logger.debug(`MessagesPanel: Skipping queue ${queueId} refresh (too soon after last refresh)`);
            } else {
              try {
                await refreshQueueDataRef.current(queueId);
                lastRefreshTimeRef.current.set(queueId, now);
                logger.debug(`MessagesPanel: Refreshed queue ${queueId}`);
              } catch (err) {
                logger.error(`MessagesPanel: Failed to refresh queue ${queueId}:`, err);
              }
            }
          } else {
            // Fallback: refresh all queues (but with deduplication and sequential processing)
            // OPTIMIZED: Process queues sequentially (one at a time) instead of in batches
            // This reduces server load significantly
            if (queueIdsArray.length > 0 && typeof refreshQueueDataRef.current === 'function') {
              const DELAY_BETWEEN_REQUESTS_MS = 400; // 400ms delay between each request

              // Process queues sequentially with delays to reduce server load
              for (const queueId of queueIdsArray) {
                const lastRefreshTime = lastRefreshTimeRef.current.get(queueId) || 0;

                if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
                  logger.debug(`MessagesPanel: Skipping queue ${queueId} refresh (too soon)`);
                  continue;
                }

                try {
                  await refreshQueueDataRef.current(queueId);
                  lastRefreshTimeRef.current.set(queueId, now);
                  logger.debug(`MessagesPanel: Refreshed queue ${queueId}`);
                } catch (err) {
                  logger.error(`MessagesPanel: Failed to refresh queue ${queueId}:`, err);
                }

                // Add delay between requests (except for the last one)
                if (queueIdsArray.indexOf(queueId) < queueIdsArray.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
                }
              }
            }
          }

          // Refetch quota (only once, not per queue)
          try {
            const quota = await messageApiClient.getMyQuota();
            setUserQuota(quota);
          } catch (err) {
            // Silently fail quota refetch
            logger.debug('MessagesPanel: Failed to refresh quota:', err);
          }
        } finally {
          isRefreshingRef.current = false;
        }
      }, DEBOUNCE_MS);
    };

    // Listen to all relevant update events
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('conditionDataUpdated', handleDataUpdate);
    window.addEventListener('messageDataUpdated', handleDataUpdate);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('conditionDataUpdated', handleDataUpdate);
      window.removeEventListener('messageDataUpdated', handleDataUpdate);
    };
  }, [queueIds]); // Only depends on stable queueIds string

  /**
   * SignalR Integration: Listen for real-time updates
   * Uses shared SignalRContext connection to avoid duplicate connections
   * Replaces polling with push-based updates for templates, queues, conditions
   */
  const { connection, isConnected } = useSignalRContext();

  useEffect(() => {
    // Only subscribe when connection is ready and connected
    if (!connection || !isConnected) {
      logger.debug('MessagesPanel: SignalR connection not ready, skipping event subscription');
      return;
    }

    const handleTemplateUpdate = () => {
      logger.debug('MessagesPanel: Received TemplateUpdated event via SignalR');
      // Trigger data refresh (will be debounced by handleDataUpdate logic)
      window.dispatchEvent(new Event('templateDataUpdated'));
    };

    const handleTemplateDelete = () => {
      logger.debug('MessagesPanel: Received TemplateDeleted event via SignalR');
      window.dispatchEvent(new Event('templateDataUpdated'));
    };

    const handleQueueUpdate = () => {
      logger.debug('MessagesPanel: Received QueueUpdated event via SignalR');
      window.dispatchEvent(new Event('queueDataUpdated'));
    };

    const handleConditionUpdate = () => {
      logger.debug('MessagesPanel: Received ConditionUpdated event via SignalR');
      window.dispatchEvent(new Event('conditionDataUpdated'));
    };

    const handleConditionDelete = () => {
      logger.debug('MessagesPanel: Received ConditionDeleted event via SignalR');
      window.dispatchEvent(new Event('conditionDataUpdated'));
    };

    // Subscribe to relevant SignalR events only when connected
    try {
      connection.on('TemplateUpdated', handleTemplateUpdate);
      connection.on('TemplateDeleted', handleTemplateDelete);
      connection.on('QueueUpdated', handleQueueUpdate);
      connection.on('ConditionUpdated', handleConditionUpdate);
      connection.on('ConditionDeleted', handleConditionDelete);
      logger.debug('MessagesPanel: Successfully subscribed to SignalR events');
    } catch (error) {
      logger.error('MessagesPanel: Error subscribing to SignalR events:', error);
    }

    return () => {
      // Cleanup: unsubscribe from events
      if (connection) {
        try {
          connection.off('TemplateUpdated', handleTemplateUpdate);
          connection.off('TemplateDeleted', handleTemplateDelete);
          connection.off('QueueUpdated', handleQueueUpdate);
          connection.off('ConditionUpdated', handleConditionUpdate);
          connection.off('ConditionDeleted', handleConditionDelete);
          logger.debug('MessagesPanel: Unsubscribed from SignalR events');
        } catch (error) {
          logger.error('MessagesPanel: Error unsubscribing from SignalR events:', error);
        }
      }
    };
  }, [connection, isConnected]);

  // Toggle queue expansion with lazy loading
  const toggleQueueExpanded = useCallback((queueId: string | number) => {
    setExpandedQueues((prev) => {
      const newSet = new Set(prev);
      const queueIdStr = String(queueId);
      const isCurrentlyExpanded = newSet.has(queueIdStr);

      if (isCurrentlyExpanded) {
        // Collapsing - just remove from set
        newSet.delete(queueIdStr);
      } else {
        // Expanding - add to set and trigger lazy load
        newSet.add(queueIdStr);
        // Lazy load queue data when expanded (with debounce to avoid rapid clicks)
        setTimeout(async () => {
          // Prevent duplicate requests
          if (loadingQueuesRef.current.has(queueIdStr)) return;

          // Check if recently loaded (within last 5 seconds)
          const lastRefreshTime = lastRefreshTimeRef.current.get(queueIdStr) || 0;
          const now = Date.now();
          const MIN_REFRESH_INTERVAL_MS = 5000;

          if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
            logger.debug(`MessagesPanel: Queue ${queueIdStr} was recently loaded, skipping`);
            return;
          }

          loadingQueuesRef.current.add(queueIdStr);

          try {
            await refreshQueueDataRef.current(queueIdStr);
            lastRefreshTimeRef.current.set(queueIdStr, now);
            logger.debug(`MessagesPanel: Loaded queue ${queueIdStr} on expand`);
          } catch (err) {
            logger.error(`MessagesPanel: Failed to load queue ${queueIdStr}:`, err);
          } finally {
            loadingQueuesRef.current.delete(queueIdStr);
          }
        }, 100); // Small delay to allow UI to update first
      }
      return newSet;
    });
  }, []);

  // Toggle all queues (expand/collapse)
  const toggleAllQueues = useCallback(() => {
    if (expandedQueues.size === filteredQueues.length) {
      // All expanded, collapse all
      setExpandedQueues(new Set());
    } else {
      // Not all expanded, expand all
      setExpandedQueues(new Set(filteredQueues.map((q) => q.id)));
    }
  }, [expandedQueues.size, filteredQueues]);

  /**
   * Check for condition intersections in a queue
   */
  const checkConditionIntersections = (queueId: string) => {
    // Get all conditions from messageConditions array (authoritative source) or fall back to template.condition
    // This matches the logic in EditTemplateModal and the template rendering to ensure consistency
    const queueConditions: MessageCondition[] = messageTemplates
      .filter((t) => t.queueId === String(queueId))
      .map((t) => {
        // Find condition from messageConditions array first, then fall back to template.condition
        return messageConditions.find((c) => c.templateId === t.id) ?? t.condition ?? null;
      })
      .filter((c): c is MessageCondition =>
        c !== null &&
        c !== undefined &&
        c.operator !== undefined &&
        c.operator !== 'DEFAULT' // Exclude DEFAULT as it's a sentinel
      );

    if (queueConditions.length < 2) return [];

    const intersections: Array<{ cond1: MessageCondition; cond2: MessageCondition; message: string }> = [];

    for (let i = 0; i < queueConditions.length; i++) {
      for (let j = i + 1; j < queueConditions.length; j++) {
        const cond1 = queueConditions[i];
        const cond2 = queueConditions[j];

        // Check if conditions overlap
        if (
          cond1.operator &&
          cond2.operator &&
          getConditionRange(cond1) &&
          getConditionRange(cond2) &&
          conditionsOverlap(cond1, cond2)
        ) {
          intersections.push({
            cond1,
            cond2,
            message: `تقاطع: ${getConditionText(cond1)} و ${getConditionText(cond2)}`
          });
        }
      }
    }

    return intersections;
  };

  /**
   * Get all condition IDs that are involved in intersections
   */
  const getConflictingConditionIds = useCallback((queueId: string): Set<string> => {
    const intersections = checkConditionIntersections(queueId);
    const conflictingIds = new Set<string>();

    intersections.forEach((intersection) => {
      conflictingIds.add(intersection.cond1.id);
      conflictingIds.add(intersection.cond2.id);
    });

    return conflictingIds;
  }, [messageConditions, messageTemplates]);

  /**
   * Helper function to get user display name following priority:
   * 1. Check if it matches current logged-in user (for admins not in moderators/users list)
   * 2. firstName + lastName (if both exist)
   * 3. firstName only (if lastName is null/empty)
   * 4. username (fallback)
   */
  const getUserDisplayName = useCallback((userId: string | number | undefined): string => {
    if (!userId) return 'غير معروف';

    const userIdStr = String(userId).trim();
    if (!userIdStr) return 'غير معروف';

    // First check if it matches the current logged-in user (for admins who may not be in moderators/users list)
    if (user && String(user.id) === userIdStr) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      }
      if (user.firstName) {
        return user.firstName;
      }
      return user.username || '-';
    }

    const allUsers = [
      ...(userManagementState.moderators || []),
      ...(userManagementState.users || []),
    ];

    // Try to find user by ID (both string and number comparison)
    const foundUser = allUsers.find(u => {
      const uIdStr = String(u.id).trim();
      const uIdNum = Number(u.id);
      const searchIdNum = Number(userIdStr);

      return uIdStr === userIdStr ||
        (!isNaN(uIdNum) && !isNaN(searchIdNum) && uIdNum === searchIdNum);
    });

    if (foundUser) {
      // If both firstName and lastName exist, show both
      if (foundUser.firstName && foundUser.lastName) {
        return `${foundUser.firstName} ${foundUser.lastName}`;
      }
      // If only firstName exists (no lastName), show firstName only
      if (foundUser.firstName) {
        return foundUser.firstName;
      }
      // Fallback to username if no firstName (username should always exist)
      if (foundUser.username) {
        return foundUser.username;
      }
    }

    // If user not found, return '-'
    return '-';
  }, [userManagementState, user]);

  /**
   * Get range representation of a condition
   * Note: All values must be >= 1 (0 and negative values are invalid)
   */
  const getConditionRange = (cond: MessageCondition): { min: number; max: number } | null => {
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
        if (cond.minValue === undefined || cond.maxValue === undefined || cond.minValue <= 0 || cond.maxValue <= 0) return null;
        return { min: cond.minValue, max: cond.maxValue };
      default:
        return null;
    }
  };

  /**
   * Check if two conditions overlap/intersect
   */
  const conditionsOverlap = (cond1: MessageCondition, cond2: MessageCondition): boolean => {
    const range1 = getConditionRange(cond1);
    const range2 = getConditionRange(cond2);

    if (!range1 || !range2) return false;

    // Two ranges overlap if NOT (range1.max < range2.min OR range2.max < range1.min)
    return !(range1.max < range2.min || range2.max < range1.min);
  };

  /**
   * Get human-readable condition text
   */
  const getConditionText = (cond: MessageCondition): string => {
    const operatorMap: Record<string, string> = {
      'UNCONDITIONED': 'بدون شرط',
      'DEFAULT': 'افتراضي',
      'EQUAL': 'يساوي',
      'GREATER': 'أكثر من',
      'LESS': 'أقل من',
      'RANGE': 'نطاق',
    };

    const operatorText = operatorMap[cond.operator] || cond.operator;

    // For UNCONDITIONED and DEFAULT, no value to show
    if (cond.operator === 'UNCONDITIONED' || cond.operator === 'DEFAULT') {
      return operatorText;
    }

    const valueText =
      cond.operator === 'RANGE' ? `${cond.minValue}-${cond.maxValue}` : cond.value;

    return `${operatorText} ${valueText}`;
  };

  /**
   * Role-based stats calculation for message quotas
   * - PrimaryAdmin: System-wide quota (sum of all)
   * - SecondaryAdmin: Assigned teams quota
   * - Moderator: Personal quota
   */
  const getRoleContextStats = useMemo(() => {
    // Use API data if available, fallback to default values
    const quotaData = userQuota || { limit: 0, used: 0 };
    const baseStats = {
      total: quotaData.limit,
      used: quotaData.used,
      remaining: quotaData.limit === -1 ? -1 : quotaData.limit - quotaData.used,
    };

    // Format value for display: show "غير محدود" for -1
    const formatQuotaValue = (value: number): string => {
      return value === -1 ? 'غير محدود' : value.toLocaleString('ar-EG-u-nu-latn');
    };

    // Since we're in moderator view (admins are redirected to ModeratorMessagesOverview)
    // Display moderator-specific labels
    return [
      {
        label: 'حصتي من الرسائل',
        value: formatQuotaValue(baseStats.total),
        color: 'blue' as const,
        info: 'عدد الرسائل المسموح لي بإرسالها'
      },
      {
        label: 'الرسائل المستخدمة',
        value: baseStats.used.toLocaleString('ar-EG-u-nu-latn'),
        color: 'yellow' as const,
        info: 'من حصتي الشخصية'
      },
      {
        label: 'الرسائل المتبقية',
        value: formatQuotaValue(baseStats.remaining),
        color: 'green' as const,
        info: ''
      },
    ];
  }, [userQuota]);

  if (isAdminView) {
    return <ModeratorMessagesOverview />;
  }

  return (
    <PanelWrapper>
      <PanelHeader
        icon="fa-envelope"
        title="إدارة قوالب الرسائل"
        description="إدارة قوالب الرسائل لكل عيادة بشكل منفصل وسهل"
        stats={getRoleContextStats}
        actions={[]}
      />

      {/* Search and Expand Controls Section */}
      {filteredQueues.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-end gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">البحث</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث حسب عنوان أو وصف القالب..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Expand/Collapse All Button */}
            <button
              onClick={toggleAllQueues}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium whitespace-nowrap h-fit"
              title="توسيع أو طي جميع العيادات"
            >
              <i className={`fas ${expandedQueues.size === filteredQueues.length ? 'fa-compress' : 'fa-expand'}`}></i>
              {expandedQueues.size === filteredQueues.length ? 'طي الكل' : 'توسيع الكل'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4 p-4">
        {filteredQueues.length === 0 ? (
          <EmptyState
            icon="fa-inbox"
            title="لا توجد عيادات"
            message="يرجى إنشاء عيادة أولاً من لوحة التحكم"
            actionLabel="اذهب إلى لوحة التحكم"
            onAction={() => {
              // Navigate to welcome screen (dashboard)
              setCurrentPanel('welcome');
              setSelectedQueueId(null);
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredQueues.map((queue) => {
              const isExpanded = expandedQueues.has(queue.id);

              return (
                <div
                  key={queue.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
                >
                  {/* Queue Header */}
                  <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-right space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => toggleQueueExpanded(queue.id)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <i
                        className={`fas fa-chevron-down text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''
                          }`}
                      ></i>
                      <div className="text-right">
                        <h4 className="font-semibold text-gray-900">
                          <i className="fas fa-hospital-user text-blue-600 ml-2"></i>
                          {queue.doctorName || `العيادة #${queue.id}`}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          📧 {messageTemplates.filter((t) => t.queueId === String(queue.id)).length} قالب رسالة
                        </p>
                      </div>
                    </button>

                    {/* Quick Stats Badge & Conflict Badge */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        📦 رسائل
                      </span>

                      {/* Conflict Badge - Only show when collapsed */}
                      {!isExpanded && (() => {
                        const intersections = checkConditionIntersections(String(queue.id));
                        return intersections.length > 0 ? (
                          <ConflictBadge
                            conflictCount={intersections.length}
                            size="sm"
                            onClick={() => toggleQueueExpanded(queue.id)}
                          />
                        ) : null;
                      })()}
                    </div>

                    {/* Add Template Button */}
                    <button
                      onClick={() => {
                        openModal('addTemplate', { queueId: String(queue.id) });
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                      title="إضافة قالب جديد"
                    >
                      <i className="fas fa-plus"></i>
                      إضافة قالب جديد
                    </button>
                  </div>

                  {/* Queue Content - Collapsible */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      {/* Conflict Details - Similar to ModeratorMessagesOverview */}
                      {(() => {
                        const intersections = checkConditionIntersections(String(queue.id));
                        return intersections.length > 0 ? (
                          <div className="border-t border-red-100 px-4 py-2 bg-red-50 space-y-2">
                            <p className="text-xs font-semibold text-red-900 mb-2">
                              ⛔ عيادات بها تضاربات:
                            </p>
                            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <i className="fas fa-exclamation-circle text-red-600 text-lg mt-0.5 flex-shrink-0"></i>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-red-900 mb-2">
                                    ⛔ خطأ: تقاطع في الشروط
                                  </p>
                                  <p className="text-xs text-red-800 mb-2">
                                    تم اكتشاف شروط متقاطعة ولا يمكن قبول هذه التكوينات. يجب تصحيح الشروط:
                                  </p>
                                  <ul className="space-y-1 text-xs text-red-800">
                                    {intersections.map((intersection, idx) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <span className="text-red-600 flex-shrink-0">✕</span>
                                        <span>{intersection.message}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Template Data Table */}
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="px-4 py-2 text-right">العنوان</th>
                                <th className="px-4 py-2 text-right">الشرط المطبق</th>
                                <th className="px-4 py-2 text-right">آخر تحديث بواسطة</th>
                                <th className="px-4 py-2 text-right">آخر تحديث</th>
                                <th className="px-4 py-2 text-right">الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {messageTemplates.filter((t) => t.queueId === String(queue.id))
                                .filter((t) => {
                                  // Search filter by title or content
                                  const searchLower = searchTerm.toLowerCase();
                                  return (
                                    t.title.toLowerCase().includes(searchLower) ||
                                    (t.content && t.content.toLowerCase().includes(searchLower))
                                  );
                                })
                                .sort((a, b) => {
                                  // Sort by creation date descending (newest first)
                                  const dateA = parseAsUtc(a.createdAt)?.getTime() || 0;
                                  const dateB = parseAsUtc(b.createdAt)?.getTime() || 0;
                                  return dateB - dateA;
                                })
                                .map((template) => {
                                  // Find condition from messageConditions array (authoritative source) or fall back to template.condition
                                  // This matches the logic in EditTemplateModal to ensure consistency
                                  const condition =
                                    messageConditions.find((c) => c.templateId === template.id) ??
                                    template.condition ??
                                    null;

                                  // Check if this template's condition is conflicting
                                  const conflictingIds = getConflictingConditionIds(String(queue.id));
                                  const hasConflict = condition && conflictingIds.has(condition.id);

                                  return (
                                    <tr key={template.id} className={`border-b border-gray-200 transition-colors ${hasConflict
                                      ? 'bg-red-100 hover:bg-red-150 border-l-4 border-l-red-600'
                                      : highlightedConditionType && condition && condition.operator === highlightedConditionType
                                        ? 'bg-yellow-100 hover:bg-yellow-150 border-l-4 border-l-yellow-500'
                                        : 'hover:bg-blue-50'
                                      }`}>
                                      <td className="px-4 py-2">
                                        <div>
                                          <p className="font-medium text-gray-900">{template.title}</p>
                                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                            {template.content.substring(0, 80)}
                                            {template.content.length > 80 ? '...' : ''}
                                          </p>
                                        </div>
                                      </td>
                                      <td className="px-4 py-2">
                                        {condition ? (
                                          condition.operator === 'DEFAULT' ? (
                                            <span className="text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full text-sm">
                                              ✓ افتراضي
                                            </span>
                                          ) : condition.operator === 'UNCONDITIONED' ? (
                                            <span className="text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full text-sm">
                                              ○ بدون شرط
                                            </span>
                                          ) : (
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {hasConflict && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs font-bold animate-pulse">
                                                  <i className="fas fa-exclamation-triangle"></i>
                                                  تضارب!
                                                </span>
                                              )}
                                              <span className="text-sm font-semibold text-blue-600">
                                                {condition.operator === 'EQUAL' && 'يساوي'}
                                                {condition.operator === 'GREATER' && 'أكثر من'}
                                                {condition.operator === 'LESS' && 'أقل من'}
                                                {condition.operator === 'RANGE' && 'نطاق'}
                                              </span>
                                              {condition.operator === 'RANGE' ? (
                                                <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                                                  {condition.minValue} - {condition.maxValue}
                                                </span>
                                              ) : (
                                                <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                                                  {condition.value}
                                                </span>
                                              )}
                                            </div>
                                          )
                                        ) : (
                                          <span className="text-amber-600 font-medium">لم يتم تحديده بعد</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className="text-sm text-gray-700">{getUserDisplayName(template.updatedBy || template.createdBy)}</span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className="text-sm text-gray-700">
                                          {template.updatedAt ? formatLocalDateTime(template.updatedAt) : '-'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              // Edit template - open edit modal
                                              openModal('editTemplate', { templateId: template.id, queueId: queue.id });
                                              addToast('فتح تحرير القالب: ' + template.title, 'info');
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                                            title="تحرير"
                                          >
                                            <i className="fas fa-edit"></i>
                                            تحرير
                                          </button>
                                          <button
                                            onClick={async (e) => {
                                              e.preventDefault();
                                              e.stopPropagation();

                                              try {
                                                const confirmOptions = createDeleteConfirmation('القالب: ' + template.title);
                                                const confirmed = await confirm(confirmOptions);
                                                if (!confirmed) return;

                                                const templateIdNum = Number(template.id);
                                                if (isNaN(templateIdNum)) {
                                                  addToast('معرّف القالب غير صالح', 'error');
                                                  return;
                                                }

                                                await messageApiClient.deleteTemplate(templateIdNum);

                                                // Refetch queue data to reflect changes
                                                if (typeof refreshQueueData === 'function' && queue.id) {
                                                  await refreshQueueData(String(queue.id));
                                                }

                                                // Refresh quota to update PanelHeader stats
                                                try {
                                                  const quota = await messageApiClient.getMyQuota();
                                                  setUserQuota(quota);
                                                } catch (err) {
                                                  // Silently fail quota refetch
                                                }

                                                // Notify other components
                                                window.dispatchEvent(new CustomEvent('templateDataUpdated'));

                                                addToast('تم حذف القالب: ' + template.title, 'success');
                                              } catch (error: any) {
                                                const errorMsg = error?.message || error?.error || 'فشل حذف القالب';
                                                addToast(errorMsg, 'error');
                                              }
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                                            title="حذف"
                                          >
                                            <i className="fas fa-trash"></i>
                                            حذف
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Additional message templates section can be added here in the future */}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Guide Section */}
      <div className="px-4 pb-4">
        <UsageGuideSection
          items={USAGE_GUIDE_ITEMS}
        />
      </div>
    </PanelWrapper>
  );
}

