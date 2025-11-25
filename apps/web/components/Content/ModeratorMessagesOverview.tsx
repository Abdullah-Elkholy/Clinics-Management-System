'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useSelectDialog } from '@/contexts/SelectDialogContext';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/roles';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { messageApiClient, type MyQuotaDto } from '@/services/api/messageApiClient';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { ConflictBadge } from '@/components/Common/ConflictBadge';
import logger from '@/utils/logger';
import type { MessageCondition } from '@/types/messageCondition';
import { useUserManagement } from '@/hooks/useUserManagement';
import { groupQueuesByModerator, type ModeratorWithStats } from '@/utils/moderatorAggregation';
import { templateDtoToModel } from '@/services/api/adapters';
import { formatLocalDateTime } from '@/utils/dateTimeUtils';
// Mock data removed - using API data instead

/**
 * Moderator Messages Overview - Admin View
 * Shows all moderators with their aggregated message templates
 * For Primary Admin and Secondary Admin roles only
 */

const USAGE_GUIDE_ITEMS = [
  {
    title: 'عرض المشرفين',
    description: 'شاهد جميع المشرفين وإحصائيات رسائلهم في بطاقات منفصلة'
  },
  {
    title: 'توسيع بطاقة المشرف',
    description: 'انقر على بطاقة المشرف لعرض جميع الطوابير والقوالب الخاصة به'
  },
  {
    title: 'إدارة القوالب',
    description: 'يمكنك تحرير وحذف قوالب الرسائل من داخل كل طابور'
  },
  {
    title: 'كشف التضاربات',
    description: 'شاهد عدد التضاربات في شروط الرسائل لكل مشرف'
  },
  {
    title: 'البحث والترتيب',
    description: 'ابحث عن المشرفين بسهولة حسب الاسم أو اسم المستخدم'
  },
];

export default function ModeratorMessagesOverview() {
  const { user } = useAuth();
  const { moderators: queueBasedModerators, queues, messageTemplates, setMessageTemplates, selectedQueueId: _selectedQueueId, setSelectedQueueId: _setSelectedQueueId, refreshQueueData } = useQueue();
  const [userManagementState, userManagementActions] = useUserManagement();
  const { addToast, setCurrentPanel } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { select: _select } = useSelectDialog();

  /**
   * Helper function to get user display name (username) for createdBy column
   * Returns username, not firstName/lastName
   */
  const getUserDisplayName = useCallback((userId: string | number | undefined): string => {
    if (!userId) return 'غير معروف';
    
    const userIdStr = String(userId).trim();
    if (!userIdStr) return 'غير معروف';
    
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
    
    // Return username, not firstName/lastName
    if (foundUser?.username) {
      return foundUser.username;
    }
    
    return 'غير معروف';
  }, [userManagementState]);

  // Filter queues and templates based on user role
  const filteredQueues = useMemo(() => {
    if (!user) return queues;
    
    const isAdmin = user.role === UserRole.PrimaryAdmin || user.role === UserRole.SecondaryAdmin;
    const isModerator = user.role === UserRole.Moderator;
    const isUser = user.role === UserRole.User;
    
    if (isAdmin) {
      // Admins see all queues
      return queues;
    } else if (isModerator) {
      // Moderators see only queues where ModeratorId == user.id
      const userId = user.id?.toString();
      return queues.filter(q => {
        const qModId = q.moderatorId?.toString();
        return qModId === userId;
      });
    } else if (isUser) {
      // Users see only queues where ModeratorId == user.assignedModerator
      if (!user.assignedModerator) return [];
      const moderatorId = user.assignedModerator.toString();
      return queues.filter(q => {
        const qModId = q.moderatorId?.toString();
        return qModId === moderatorId;
      });
    }
    
    return queues;
  }, [queues, user]);

  // Filter templates based on filtered queues
  const filteredTemplates = useMemo(() => {
    if (!user) return messageTemplates;
    
    const filteredQueueIds = new Set(filteredQueues.map(q => q.id.toString()));
    return messageTemplates.filter(t => {
      const templateQueueId = t.queueId?.toString();
      return templateQueueId && filteredQueueIds.has(templateQueueId);
    });
  }, [messageTemplates, filteredQueues, user]);

  // State for search and expansion
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModerators, setExpandedModerators] = useState<Set<string | number>>(new Set());
  const [expandedQueues, setExpandedQueues] = useState<Set<string>>(new Set());
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
  }, []); // Only run once on mount

  /**
   * Fetch users and moderators separately to avoid dependency issues
   */
  useEffect(() => {
    // Fetch users and moderators to populate userManagementState for getUserDisplayName
    if (user && (user.role === UserRole.PrimaryAdmin || user.role === UserRole.SecondaryAdmin || user.role === UserRole.Moderator)) {
      userManagementActions.fetchUsers();
      userManagementActions.fetchModerators();
    }
  }, [user]); // Only depend on user, not userManagementActions

  /**
   * Initial load: Refresh queue data for all filtered queues when queues are available
   * This is similar to MessagesPanel - it calls refreshQueueData for all queues
   * This ensures templates and conditions are loaded into context
   */
  useEffect(() => {
    const loadAllQueueData = async () => {
      if (filteredQueues.length === 0) return;
      if (typeof refreshQueueData !== 'function') return;

      logger.debug('ModeratorMessagesOverview: Initial load - refreshing all filtered queues', {
        queueCount: filteredQueues.length,
        queueIds: filteredQueues.map(q => q.id.toString()),
      });

      // Refresh all filtered queues in parallel
      // This loads templates and conditions into context properly
      await Promise.all(
        filteredQueues.map(async (queue) => {
          try {
            const queueIdStr = String(queue.id);
            await refreshQueueData(queueIdStr);
          } catch (refreshError) {
            logger.error(`Failed to refresh queue ${queue.id}:`, refreshError);
          }
        })
      );

      logger.debug('ModeratorMessagesOverview: Finished initial load of all queue data');
    };

    loadAllQueueData();
  }, [filteredQueues, refreshQueueData]);

  /**
   * Load all templates for filtered queues when queues are available
   * This ensures templates are fetched initially without needing to select a specific queue
   */
  useEffect(() => {
    const loadAllTemplates = async () => {
      if (filteredQueues.length === 0) return;

      try {
        // Always fetch templates to ensure we have the latest data
        // This fixes the issue where templates disappear after refresh
        const templateResponse = await messageApiClient.getTemplates();
        const templateDtos = templateResponse.items || [];

        logger.debug('ModeratorMessagesOverview: Loaded templates from API', {
          templateCount: templateDtos.length,
          filteredQueuesCount: filteredQueues.length,
          templateQueueIds: templateDtos.map(t => t.queueId),
        });

        // Get filtered queue IDs for matching
        const filteredQueueIds = new Set(filteredQueues.map(q => q.id.toString()));
        
        // Filter templates to only those belonging to filtered queues
        const relevantTemplates = templateDtos.filter(dto => {
          const templateQueueId = dto.queueId?.toString();
          const isRelevant = templateQueueId && filteredQueueIds.has(templateQueueId);
          if (!isRelevant && templateQueueId) {
            logger.debug('ModeratorMessagesOverview: Template filtered out', {
              templateId: dto.id,
              templateQueueId,
              filteredQueueIds: Array.from(filteredQueueIds),
            });
          }
          return isRelevant;
        });

        logger.debug('ModeratorMessagesOverview: Relevant templates after filtering', {
          relevantCount: relevantTemplates.length,
          relevantTemplateIds: relevantTemplates.map(t => ({ id: t.id, queueId: t.queueId })),
        });

        // IMPORTANT: Directly populate templates into context from the API response
        // This ensures templates are available immediately, not just after refreshQueueData
        if (relevantTemplates.length > 0 && setMessageTemplates) {
          // Convert DTOs to models and merge with existing templates
          const newTemplates = relevantTemplates.map(dto => {
            const queueIdStr = dto.queueId?.toString() || '';
            return templateDtoToModel(dto, queueIdStr);
          });

          logger.debug('ModeratorMessagesOverview: Adding templates directly to context', {
            newTemplatesCount: newTemplates.length,
            newTemplateQueueIds: newTemplates.map(t => t.queueId),
            filteredQueueIds: Array.from(filteredQueueIds),
          });

          // Merge with existing templates, replacing templates for these queues
          setMessageTemplates((prevTemplates) => {
            const filteredQueueIdsSet = new Set(filteredQueueIds);
            const templatesForOtherQueues = prevTemplates.filter(t => {
              const tQueueId = t.queueId?.toString();
              return !tQueueId || !filteredQueueIdsSet.has(tQueueId);
            });
            const merged = [...templatesForOtherQueues, ...newTemplates];
            logger.debug('ModeratorMessagesOverview: Merged templates', {
              previousCount: prevTemplates.length,
              otherQueuesCount: templatesForOtherQueues.length,
              newCount: newTemplates.length,
              mergedCount: merged.length,
            });
            return merged;
          });
        } else {
          logger.debug('ModeratorMessagesOverview: No relevant templates to add', {
            relevantTemplatesCount: relevantTemplates.length,
            hasSetMessageTemplates: !!setMessageTemplates,
            filteredQueueIds: Array.from(filteredQueueIds),
          });
        }

        // NOTE: refreshQueueData is called in a separate useEffect (above) when filteredQueues change
        // This prevents duplicate calls and ensures proper loading order
      } catch (error) {
        logger.error('Failed to load templates in ModeratorMessagesOverview:', error);
        // Even on error, try to refresh queues to ensure state consistency
        if (typeof refreshQueueData === 'function') {
          const filteredQueueIds = filteredQueues.map(q => q.id.toString());
          await Promise.all(
            filteredQueueIds.map(async (queueId) => {
              try {
                await refreshQueueData(queueId);
              } catch (refreshError) {
                logger.error(`Failed to refresh queue ${queueId}:`, refreshError);
              }
            })
          );
        }
      }
    };

    loadAllTemplates();
  }, [filteredQueues, refreshQueueData]);

  /**
   * Listen for data updates and refetch queue data
   * Similar to MessagesPanel - this ensures templates are refreshed when data changes
   */
  useEffect(() => {
    const handleDataUpdate = async () => {
      // Refetch data for all filtered queues to ensure consistency
      if (filteredQueues.length > 0 && typeof refreshQueueData === 'function') {
        for (const queue of filteredQueues) {
          await refreshQueueData(String(queue.id));
        }
      }
    };

    // Listen to all relevant update events (same as MessagesPanel)
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('conditionDataUpdated', handleDataUpdate);
    window.addEventListener('messageDataUpdated', handleDataUpdate);

    return () => {
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('conditionDataUpdated', handleDataUpdate);
      window.removeEventListener('messageDataUpdated', handleDataUpdate);
    };
  }, [filteredQueues, refreshQueueData]);

  /**
   * Debug: Log template counts when they change
   */
  useEffect(() => {
    logger.debug('ModeratorMessagesOverview: Template state changed', {
      totalTemplates: messageTemplates.length,
      filteredTemplates: filteredTemplates.length,
      filteredQueues: filteredQueues.length,
      templateQueueIds: messageTemplates.map(t => t.queueId),
      filteredQueueIds: filteredQueues.map(q => q.id.toString()),
    });
  }, [messageTemplates.length, filteredTemplates.length, filteredQueues.length]);

  // Toggle moderator expansion
  const toggleModeratorExpanded = useCallback((moderatorId: string | number) => {
    setExpandedModerators((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moderatorId)) {
        newSet.delete(moderatorId);
      } else {
        newSet.add(moderatorId);
      }
      return newSet;
    });
  }, []);

  // Toggle queue expansion
  const toggleQueueExpanded = useCallback((queueId: string) => {
    setExpandedQueues((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(queueId)) {
        newSet.delete(queueId);
      } else {
        newSet.add(queueId);
      }
      return newSet;
    });
  }, []);

  /**
   * Check for condition intersections in a queue (same logic as MessagesPanel)
   */
  const checkConditionIntersections = (_queueId: string) => {
    const queueConditions: MessageCondition[] = [];

    if (queueConditions.length < 2) return [];

    const intersections: Array<{ cond1: MessageCondition; cond2: MessageCondition; message: string }> = [];

    for (let i = 0; i < queueConditions.length; i++) {
      for (let j = i + 1; j < queueConditions.length; j++) {
        const cond1 = queueConditions[i];
        const cond2 = queueConditions[j];

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
   * Get range representation of a condition
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
   * Check if two conditions overlap
   */
  const conditionsOverlap = (cond1: MessageCondition, cond2: MessageCondition): boolean => {
    const range1 = getConditionRange(cond1);
    const range2 = getConditionRange(cond2);
    
    if (!range1 || !range2) return false;
    
    return !(range1.max < range2.min || range2.max < range1.min);
  };

  /**
   * Get human-readable condition text
   */
  const getConditionText = (cond: MessageCondition): string => {
    const operatorMap: Record<string, string> = {
      'EQUAL': 'يساوي',
      'GREATER': 'أكثر من',
      'LESS': 'أقل من',
      'RANGE': 'نطاق',
    };

    const operatorText = operatorMap[cond.operator] || cond.operator;
    const valueText =
      cond.operator === 'RANGE' ? `${cond.minValue}-${cond.maxValue}` : cond.value;

    return `${operatorText} ${valueText}`;
  };

  /**
   * Merge queue-based moderators with user management moderators
   * Prioritize firstName first, then fall back to username or ID
   * Uses filtered queues and templates based on user role
   */
  const moderators = useMemo(() => {
    // Recalculate queue-based moderators using filtered queues and templates
    const filteredQueueBasedModerators = groupQueuesByModerator(
      filteredQueues,
      filteredTemplates,
      [], // messageConditions - will be loaded separately if needed
      userManagementState.moderators
    );
    
    // Create a map of queue-based moderators by ID
    const queueModeratorMap = new Map<string | number, typeof filteredQueueBasedModerators[0]>();
    filteredQueueBasedModerators.forEach(mod => {
      const normalizedId = String(mod.moderatorId);
      queueModeratorMap.set(normalizedId, mod);
      if (typeof mod.moderatorId === 'number') {
        queueModeratorMap.set(String(mod.moderatorId), mod);
      }
    });
    
    // Merge with all moderators from user management
    const mergedModerators: ModeratorWithStats[] = [];
    const processedIds = new Set<string>();
    
    // Helper function to get moderator display name following priority:
    // 1. firstName + lastName (if both exist)
    // 2. firstName (if lastName is null/empty)
    // 3. username (fallback)
    const getModeratorDisplayName = (userMod: typeof userManagementState.moderators[0], modId: string): string => {
      if (userMod.firstName && userMod.lastName) {
        return `${userMod.firstName} ${userMod.lastName}`;
      }
      if (userMod.firstName) {
        return userMod.firstName;
      }
      // Use username instead of ID as fallback
      return userMod.username || 'غير معروف';
    };

    // First, add all moderators from user management
    userManagementState.moderators.forEach(userMod => {
      const modId = String(userMod.id || userMod.username);
      processedIds.add(modId);
      
      // Check if this moderator has queues
      const queueMod = queueModeratorMap.get(modId) || 
                       (typeof userMod.id === 'number' ? queueModeratorMap.get(String(userMod.id)) : undefined);
      
      if (queueMod) {
        // Use queue-based data but update moderatorName from user data following priority
        const updatedQueueMod = {
          ...queueMod,
          moderatorName: getModeratorDisplayName(userMod, modId),
        };
        mergedModerators.push(updatedQueueMod);
      } else {
        // Moderator exists but has no queues
        const moderatorName = getModeratorDisplayName(userMod, modId);
        
        mergedModerators.push({
          moderatorId: modId,
          moderatorName: moderatorName,
          moderatorUsername: userMod.username || `moderator_${modId}`,
          queuesCount: 0,
          templatesCount: 0,
          conflictCount: 0,
          queues: [],
        });
      }
    });
    
    // Also include any queue-based moderators that might not be in user management (edge case)
    filteredQueueBasedModerators.forEach(queueMod => {
      const normalizedId = String(queueMod.moderatorId);
      if (!processedIds.has(normalizedId)) {
        mergedModerators.push(queueMod);
        processedIds.add(normalizedId);
      }
    });
    
    // Sort by moderator ID
    return mergedModerators.sort((a, b) => Number(a.moderatorId) - Number(b.moderatorId));
  }, [filteredQueues, filteredTemplates, userManagementState.moderators]);

  /**
   * Filter moderators by search term
   */
  const filteredModerators = useMemo(() => {
    if (!searchTerm) return moderators;
    
    const searchLower = searchTerm.toLowerCase();
    return moderators.filter((mod) =>
      mod.moderatorName.toLowerCase().includes(searchLower) ||
      mod.moderatorUsername.toLowerCase().includes(searchLower)
    );
  }, [moderators, searchTerm]);

  // Toggle all moderators - must be defined after moderators useMemo
  const toggleAllModerators = useCallback(() => {
    if (expandedModerators.size === moderators.length) {
      setExpandedModerators(new Set());
    } else {
      setExpandedModerators(new Set(moderators.map((m) => m.moderatorId)));
    }
  }, [expandedModerators.size, moderators]);

  /**
   * Role-based stats for admin view showing system-wide quota
   */
  const getAdminStats = useMemo(() => {
    // Use API data if available, fallback to default values
    const quotaData = userQuota || { limit: 0, used: 0 };
    
    const baseStats = {
      total: quotaData.limit,
      used: quotaData.used,
      remaining: quotaData.limit === -1 ? -1 : quotaData.limit - quotaData.used,
    };

    // Format value for display: show "غير محدود" for -1
    const formatQuotaValue = (value: number): string => {
      return value === -1 ? 'غير محدود' : value.toLocaleString('ar-SA');
    };

    return [
      {
        label: 'عدد المشرفين',
        value: moderators.length.toString(),
        color: 'blue' as const,
        info: 'إجمالي المشرفين في النظام'
      },
      {
        label: 'إجمالي الرسائل في النظام',
        value: formatQuotaValue(baseStats.total),
        color: 'blue' as const,
        info: 'مجموع رسائل جميع الفرق'
      },
      {
        label: 'الرسائل المستخدمة',
        value: baseStats.used.toLocaleString('ar-SA'),
        color: 'yellow' as const,
        info: 'من المجموع الكلي للنظام'
      },
      {
        label: 'الرسائل المتبقية',
        value: formatQuotaValue(baseStats.remaining),
        color: 'green' as const,
        info: ''
      },
    ];
  }, [moderators.length, userQuota]);

  return (
    <PanelWrapper>
      <PanelHeader
        icon="fa-envelope"
        title="إدارة قوالب الرسائل - عرض المشرفين"
        description="إدارة قوالب الرسائل لكل مشرف بشكل شامل وسهل"
        stats={getAdminStats}
        actions={[]}
      />

      {/* Search and Expand Controls Section */}
      {moderators.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-end gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">البحث</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث حسب اسم المشرف أو اسم المستخدم..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Expand/Collapse All Button */}
            <button
              onClick={toggleAllModerators}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium whitespace-nowrap h-fit"
              title="توسيع أو طي جميع المشرفين"
            >
              <i className={`fas ${expandedModerators.size === moderators.length ? 'fa-compress' : 'fa-expand'}`}></i>
              {expandedModerators.size === moderators.length ? 'طي الكل' : 'توسيع الكل'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4 p-4">
        {/* Check if there are any queues first, then check moderators */}
        {queues.length === 0 && moderators.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="لا يوجد مشرفين"
            message="لم يتم العثور على أي مشرفين في النظام"
            actionLabel="اذهب إلى لوحة التحكم"
            onAction={() => {
              // Navigation now handled by UIContext router
              // Use setCurrentPanel('management') instead of window.location
              setCurrentPanel('management');
            }}
          />
        ) : moderators.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="لا يوجد مشرفين"
            message="لم يتم العثور على أي مشرفين في النظام"
            actionLabel="اذهب إلى لوحة التحكم"
            onAction={() => {
              // Navigation now handled by UIContext router
              // Use setCurrentPanel('management') instead of window.location
              setCurrentPanel('management');
            }}
          />
        ) : filteredModerators.length === 0 ? (
          <EmptyState
            icon="fa-search"
            title="لا توجد نتائج"
            message={`لم يتم العثور على مشرفين يطابقون "${searchTerm}"`}
            actionLabel="مسح البحث"
            onAction={() => setSearchTerm('')}
          />
        ) : (
          <div className="space-y-3">
            {filteredModerators.map((moderator) => {
              const isExpanded = expandedModerators.has(moderator.moderatorId);
              const moderatorQueues = moderator.queues;

              return (
                <div
                  key={moderator.moderatorId}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
                >
                  {/* Moderator Header Tile */}
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-right space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => toggleModeratorExpanded(moderator.moderatorId)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <i
                        className={`fas fa-chevron-down text-gray-600 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      ></i>
                      <div className="text-right">
                        <h4 className="font-semibold text-gray-900">
                          <i className="fas fa-user-tie text-purple-600 ml-2"></i>
                          {moderator.moderatorName}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          👤 @{moderator.moderatorUsername}
                        </p>
                      </div>
                    </button>

                    {/* Stats Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        🏥 {moderator.queuesCount} طابور
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        📧 {moderator.templatesCount} قالب
                      </span>
                      
                      {/* Conflict Badge */}
                      {moderator.conflictCount > 0 && (
                        <ConflictBadge 
                          conflictCount={moderator.conflictCount}
                          size="sm"
                          onClick={() => toggleModeratorExpanded(moderator.moderatorId)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Conflict Details - Show which queues have conflicts */}
                  {moderator.conflictCount > 0 && (
                    <div className="border-t border-red-100 px-4 py-2 bg-red-50 space-y-2">
                      <p className="text-xs font-semibold text-red-900">
                        ⛔ طوابير بها تضاربات:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {moderator.queues
                          .map((queue) => {
                            const queueConditions: MessageCondition[] = [];

                            if (queueConditions.length < 2) return null;

                            let hasConflict = false;
                            for (let i = 0; i < queueConditions.length; i++) {
                              for (let j = i + 1; j < queueConditions.length; j++) {
                                const cond1 = queueConditions[i];
                                const cond2 = queueConditions[j];

                                if (
                                  cond1.operator &&
                                  cond2.operator &&
                                  getConditionRange(cond1) &&
                                  getConditionRange(cond2) &&
                                  conditionsOverlap(cond1, cond2)
                                ) {
                                  hasConflict = true;
                                  break;
                                }
                              }
                              if (hasConflict) break;
                            }

                            return hasConflict ? queue : null;
                          })
                          .filter((queue) => queue !== null)
                          .map((queue) => (
                            <span
                              key={queue?.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-200 text-red-800 rounded text-xs font-medium cursor-pointer hover:bg-red-300 transition-colors"
                              onClick={() => toggleQueueExpanded(String(queue?.id))}
                              title="اضغط لفتح الطابور"
                            >
                              <i className="fas fa-exclamation-triangle"></i>
                              {queue?.doctorName || `الطابور #${queue?.id}`}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Moderator Content - Collapsible Queues List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      {moderatorQueues.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500 text-sm">لا توجد طوابير لهذا المشرف بعد</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {moderatorQueues.map((queue) => {
                            // Use filteredTemplates instead of messageTemplates to ensure role-based filtering
                            const queueTemplates = filteredTemplates.filter((t) => t.queueId === String(queue.id));
                            const intersections = checkConditionIntersections(String(queue.id));
                            const isQueueExpanded = expandedQueues.has(String(queue.id));

                            return (
                              <div
                                key={queue.id}
                                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-400 transition-colors"
                              >
                                {/* Queue Header - Collapsible */}
                                <div
                                  className="px-3 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-right"
                                >
                                  <button
                                    onClick={() => toggleQueueExpanded(String(queue.id))}
                                    className="flex items-center gap-2 flex-1 text-right bg-transparent border-0 p-0 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded cursor-pointer"
                                  >
                                    <i
                                      className={`fas fa-chevron-down text-gray-600 transition-transform ${
                                        isQueueExpanded ? 'rotate-180' : ''
                                      }`}
                                    ></i>
                                    <div className="text-right">
                                      <h5 className="font-medium text-gray-900">
                                        <i className="fas fa-hospital-user text-blue-600 ml-2"></i>
                                        {queue.doctorName || `الطابور #${queue.id}`}
                                      </h5>
                                      <p className="text-xs text-gray-600 mt-1">
                                        📧 {queueTemplates.length} قالب رسالة
                                      </p>
                                    </div>
                                  </button>
                                  
                                  {/* Quick Stats */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {intersections.length > 0 && (
                                      <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                                        ⛔ {intersections.length} تضارب
                                      </span>
                                    )}
                                    <button
                                      onClick={() => {
                                        openModal('addTemplate', { queueId: String(queue.id) });
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                                      title="إضافة قالب جديد"
                                    >
                                      <i className="fas fa-plus"></i>
                                      إضافة قالب رسالة
                                    </button>
                                  </div>
                                </div>

                                {/* Queue Content - Collapsible Templates */}
                                {isQueueExpanded && (
                                  <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-3">
                                    {/* Intersection Warning */}
                                    {intersections.length > 0 && (
                                      <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-2">
                                        <p className="text-xs font-semibold text-red-900 mb-1">
                                          ⛔ خطأ: تقاطع في الشروط
                                        </p>
                                        <ul className="space-y-1 text-xs text-red-800">
                                          {intersections.slice(0, 2).map((intersection, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                              <span className="text-red-600 flex-shrink-0">✕</span>
                                              <span>{intersection.message}</span>
                                            </li>
                                          ))}
                                          {intersections.length > 2 && (
                                            <li className="text-red-800 font-medium">
                                              ...و {intersections.length - 2} تضاربات أخرى
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Queue Templates Table */}
                                    {queueTemplates.length > 0 ? (
                                      <div className="bg-white rounded border border-gray-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-gray-100 border-b border-gray-200">
                                                <th className="px-3 py-1 text-right">العنوان</th>
                                                <th className="px-3 py-1 text-right">الشرط المطبق</th>
                                                <th className="px-3 py-1 text-right">انشئ بواسطة</th>
                                                <th className="px-3 py-1 text-right">آخر تحديث</th>
                                                <th className="px-3 py-1 text-right">الإجراءات</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {queueTemplates
                                                .sort((_a, _b) => {
                                                  return 0;
                                                })
                                                .map((template) => {
                                                  // Resolve condition from embedded template.condition
                                                  const condition = template.condition;

                                                  return (
                                                    <tr key={template.id} className="border-b border-gray-200 hover:bg-blue-50">
                                                      <td className="px-3 py-1">
                                                        <p className="font-medium text-gray-900">{template.title}</p>
                                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                                          {template.content.substring(0, 80)}
                                                          {template.content.length > 80 ? '...' : ''}
                                                        </p>
                                                      </td>
                                                      <td className="px-3 py-1">
                                                        {condition ? (
                                                          condition.operator === 'DEFAULT' ? (
                                                            <span className="text-green-600 text-xs font-medium">✓ افتراضي</span>
                                                          ) : condition.operator === 'UNCONDITIONED' ? (
                                                            <span className="text-gray-600 text-xs font-medium">بدون شرط</span>
                                                          ) : (
                                                            <div className="flex items-center gap-2 flex-wrap">
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
                                                          <span className="text-amber-600 text-xs font-medium">لم يتم تحديده</span>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-1">
                                                        <span className="text-xs text-gray-700">{getUserDisplayName(template.createdBy)}</span>
                                                      </td>
                                                      <td className="px-3 py-1">
                                                        <span className="text-xs text-gray-700">
                                                          {template.updatedAt ? formatLocalDateTime(template.updatedAt instanceof Date ? template.updatedAt : new Date(template.updatedAt)) : '-'}
                                                        </span>
                                                      </td>
                                                      <td className="px-3 py-1">
                                                        <div className="flex items-center gap-1">
                                                          <button
                                                            onClick={() => {
                                                              openModal('editTemplate', { templateId: template.id, queueId: queue.id });
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                                                            title="تحرير"
                                                          >
                                                            <i className="fas fa-edit"></i>
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
                                                                
                                                                // Notify other components
                                                                window.dispatchEvent(new CustomEvent('templateDataUpdated'));
                                                                
                                                                addToast('تم حذف القالب: ' + template.title, 'success');
                                                              } catch (error: any) {
                                                                const errorMsg = error?.message || error?.error || 'فشل حذف القالب';
                                                                addToast(errorMsg, 'error');
                                                              }
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                                                            title="حذف"
                                                          >
                                                            <i className="fas fa-trash"></i>
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
                                    ) : (
                                      <div className="text-center py-4">
                                        <p className="text-gray-500 text-sm">لا توجد قوالب رسائل في هذا الطابور بعد</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
