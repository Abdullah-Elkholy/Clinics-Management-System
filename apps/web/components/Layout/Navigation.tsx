'use client';

import React from 'react';
import { useQueue } from '../../contexts/QueueContext';
import { useUI } from '../../contexts/UIContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirmDialog } from '../../contexts/ConfirmationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalProgress } from '../../contexts/GlobalProgressContext';
import { UserRole } from '../../types/roles';
import { createDeleteConfirmation } from '../../utils/confirmationHelpers';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';
import { SidebarHeader } from './SidebarHeader';
import { NavigationItem } from './NavigationItem';
import { TabItem } from './TabItem';
import { QueueListItem } from './QueueListItem';
import { LoadingSpinner } from '@/components/state';
import logger from '@/utils/logger';
import queuesApiClient from '@/services/api/queuesApiClient';
import { useUserManagement } from '../../hooks/useUserManagement';
import type { ModeratorWithStats } from '@/utils/moderatorAggregation';


export default function Navigation() {
  const { queues, selectedQueueId, setSelectedQueueId, moderators: queueBasedModerators, queuesLoading, refreshQueues } = useQueue();
  const { currentPanel, setCurrentPanel, addToast, taskPanelBadges, resetBadge } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { isCollapsed, toggleCollapse, isHydrated } = useSidebarCollapse();
  const { user, isAuthenticated } = useAuth();
  const [userManagementState, userManagementActions] = useUserManagement();
  const { hasOngoingOperations, operations } = useGlobalProgress();

  // Calculate if any messages are actively being sent (for pulse animation)
  const isActivelySending = React.useMemo(() => {
    if (!hasOngoingOperations || !operations || operations.length === 0) return false;
    return operations.some(op =>
      op.status === 'sending' ||
      (op.messages && op.messages.some(m => m.status === 'sending'))
    );
  }, [hasOngoingOperations, operations]);

  // Listen for user data updates to refresh moderators in sidebar
  // Use ref to prevent infinite loops from userManagementActions dependency changes
  const userManagementActionsRef = React.useRef(userManagementActions);
  React.useEffect(() => {
    userManagementActionsRef.current = userManagementActions;
  }, [userManagementActions]);

  React.useEffect(() => {
    const handleUserDataUpdate = async () => {
      // Refetch moderators when user data is updated (e.g., new moderator created)
      await userManagementActionsRef.current.fetchModerators();
    };

    // Initial fetch of moderators
    userManagementActionsRef.current.fetchModerators();

    window.addEventListener('userDataUpdated', handleUserDataUpdate);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
    };
  }, []); // Empty deps - event listener doesn't need to re-register, ref provides latest actions

  // Role flags
  const isPrimaryAdmin = user?.role === UserRole.PrimaryAdmin;
  const isSecondaryAdmin = user?.role === UserRole.SecondaryAdmin;
  const isAdmin = isPrimaryAdmin || isSecondaryAdmin; // Admin views get moderator grouping
  const isModerator = user?.role === UserRole.Moderator;
  const isUser = user?.role === UserRole.User;

  // Merge all moderators from system with queue-based moderators
  const allModerators = React.useMemo<ModeratorWithStats[]>(() => {
    if (!isAdmin) {
      return queueBasedModerators;
    }

    // Create a map of queue-based moderators by ID (normalize to string for comparison)
    const queueModeratorMap = new Map<string, ModeratorWithStats>();
    queueBasedModerators.forEach(mod => {
      const normalizedId = String(mod.moderatorId);
      queueModeratorMap.set(normalizedId, mod);
      // Also store with numeric ID if it's a number (for backward compatibility)
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
      return userMod.username || 'Unknown';
    };

    // First, add all moderators from user management
    userManagementState.moderators.forEach(userMod => {
      const modId = String(userMod.id || userMod.username);
      processedIds.add(modId);

      // Check if this moderator has queues (try multiple ID formats for matching)
      // Handle both string and numeric ID comparisons
      let queueMod = queueModeratorMap.get(modId);

      // If not found, try numeric comparison
      if (!queueMod && !isNaN(Number(userMod.id)) && !isNaN(Number(modId))) {
        // Try to find by numeric value
        for (const [key, value] of queueModeratorMap.entries()) {
          const keyNum = Number(key);
          const modIdNum = Number(modId);
          if (!isNaN(keyNum) && !isNaN(modIdNum) && keyNum === modIdNum) {
            queueMod = value;
            break;
          }
        }
      }

      if (queueMod) {
        // Use queue-based data (has queues, stats, etc.)
        // But update moderatorName from user data following priority
        const updatedQueueMod = {
          ...queueMod,
          moderatorName: getModeratorDisplayName(userMod, modId),
          moderatorUsername: userMod.username || queueMod.moderatorUsername, // Use real username
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
    queueBasedModerators.forEach(queueMod => {
      const normalizedId = String(queueMod.moderatorId);
      if (!processedIds.has(normalizedId)) {
        mergedModerators.push(queueMod);
        processedIds.add(normalizedId);
      }
    });

    // Sort by moderator ID
    return mergedModerators.sort((a, b) => Number(a.moderatorId) - Number(b.moderatorId));
  }, [isAdmin, queueBasedModerators, userManagementState.moderators]);

  const moderators = allModerators;

  // Custom width state for resizing
  // Default to 400px (expanded) to match expand button behavior
  const [customWidth, setCustomWidth] = React.useState<number | null>(400);
  const isResizing = React.useRef(false);
  const wasCollapsedByDrag = React.useRef(false); // Track if we collapsed due to dragging narrow

  // Detect icon-only mode: either collapsed via toggle OR dragged to narrow width (56px)
  const isIconOnly = isCollapsed || customWidth === 56;

  // Sync customWidth with isCollapsed state when hydrated from localStorage
  // This prevents the sidebar from auto-expanding due to initial customWidth (400) being > 120
  React.useEffect(() => {
    if (isHydrated) {
      // On hydration, set customWidth based on the persisted isCollapsed state
      if (isCollapsed) {
        setCustomWidth(56); // Collapsed width
      }
    }
  }, [isHydrated]); // Only run on hydration, not on isCollapsed changes

  // Auto-collapse/expand based on width thresholds during drag
  // When collapsed: expand when width > 120px
  // When expanded: collapse when width < 80px
  // ONLY trigger during active resizing to prevent unwanted auto-expand on navigation
  React.useEffect(() => {
    if (customWidth !== null && isResizing.current) {
      if (isCollapsed && customWidth > 120) {
        // Sidebar is collapsed but dragged wider - auto expand
        wasCollapsedByDrag.current = true;
        toggleCollapse();
      } else if (!isCollapsed && customWidth < 80) {
        // Sidebar is expanded but dragged narrower - auto collapse
        wasCollapsedByDrag.current = true;
        toggleCollapse();
      }
    }
  }, [customWidth, isCollapsed, toggleCollapse]);

  // Update CSS variable for sidebar width (used by spacer)
  React.useEffect(() => {
    let sidebarWidth: string;
    if (customWidth) {
      sidebarWidth = `${customWidth}px`;
    } else if (isCollapsed) {
      // Use responsive width values
      sidebarWidth = 'var(--sidebar-collapsed-width)';
    } else {
      sidebarWidth = 'var(--sidebar-expanded-width)';
    }
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
  }, [customWidth, isCollapsed]);

  // Reset drag collapse flag when manually toggling
  const handleToggleCollapse = React.useCallback(() => {
    wasCollapsedByDrag.current = false; // Clear flag when manually toggling
    if (isIconOnly) {
      // Currently icon-only, expand to maximum width
      setCustomWidth(400); // Expand to max width
      if (isCollapsed) {
        toggleCollapse(); // Also toggle off isCollapsed flag
      }
    } else {
      // Currently expanded, collapse to icon-only
      setCustomWidth(56); // Set to icon-only width
      if (!isCollapsed) {
        toggleCollapse(); // Toggle on isCollapsed flag
      }
    }
  }, [isIconOnly, isCollapsed, toggleCollapse]);

  // Expanded moderators state (admin view only) - persist to localStorage
  const [expandedModerators, setExpandedModerators] = React.useState<Set<string | number>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('expandedModerators');
      if (stored) {
        try {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) {
            return new Set(arr);
          }
        } catch { /* ignore */ }
      }
    }
    return new Set();
  });
  // Track which moderator's task panels are currently active (for moderators without queues) - persist to localStorage
  const [selectedModeratorId, setSelectedModeratorId] = React.useState<string | number | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedModeratorId') || null;
    }
    return null;
  });

  // Persist expandedModerators to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('expandedModerators', JSON.stringify(Array.from(expandedModerators)));
    }
  }, [expandedModerators]);

  // Persist selectedModeratorId to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedModeratorId !== null) {
        localStorage.setItem('selectedModeratorId', String(selectedModeratorId));
      } else {
        localStorage.removeItem('selectedModeratorId');
      }
    }
  }, [selectedModeratorId]);

  const toggleModeratorExpanded = React.useCallback((moderatorId: string | number) => {
    setExpandedModerators(prev => {
      const next = new Set(prev);
      if (next.has(moderatorId)) next.delete(moderatorId); else next.add(moderatorId);
      return next;
    });
  }, []);

  // Track the active moderator (the one whose queue is currently selected)
  // This helps determine when to keep moderator expanded vs when to collapse
  const activeModeratorIdRef = React.useRef<string | number | null>(null);

  // Get moderator ID for the currently selected queue
  const getModeratorIdForQueue = React.useCallback((queueId: string | null): string | number | null => {
    if (!queueId) return null;
    const queue = queues.find(q => String(q.id) === String(queueId));
    return queue?.moderatorId ?? null;
  }, [queues]);

  // Auto-expand only the active moderator (whose queue is selected or task panel clicked), collapse all others
  // This ensures only one moderator is expanded at a time for clarity
  // Skip on initial mount to allow URL sync to complete first (localStorage has the correct state)
  const isInitialMountRef = React.useRef(true);
  React.useEffect(() => {
    // Skip on initial mount - localStorage already has the correct state
    // and we don't want to collapse before URL sync sets currentPanel
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!isAdmin) return; // Only for admin view

    const currentModeratorId = getModeratorIdForQueue(selectedQueueId);
    const isTaskPanel = currentPanel === 'ongoing' || currentPanel === 'failed' || currentPanel === 'completed';
    const isQueuePanel = isTaskPanel || (currentPanel === 'welcome' && selectedQueueId !== null);
    const isUpperPanel = currentPanel === 'messages' || currentPanel === 'management';

    // Determine which moderator should be active
    // Priority: queue-based moderator > explicitly selected moderator
    const activeModId = currentModeratorId || (isTaskPanel ? selectedModeratorId : null);

    if (activeModId && isQueuePanel) {
      // Moderator is active (via queue or explicit selection) - expand ONLY this moderator
      setExpandedModerators(prev => {
        const normalizedModId = String(activeModId);
        // Only update if not already in correct state
        if (prev.size === 1 && Array.from(prev).some(id => String(id) === normalizedModId)) {
          return prev; // Already correct state
        }
        const next = new Set<string | number>();
        next.add(activeModId);
        return next;
      });
      activeModeratorIdRef.current = activeModId;
    } else if (isUpperPanel) {
      // Navigating to upper panels - collapse ALL moderators and clear selected moderator
      setExpandedModerators(prev => {
        if (prev.size === 0) {
          return prev; // Already collapsed
        }
        return new Set();
      });
      activeModeratorIdRef.current = null;
      setSelectedModeratorId(null);
    }
    // Keep current state if on task panel with no moderator identified
  }, [selectedQueueId, currentPanel, isAdmin, getModeratorIdForQueue, selectedModeratorId]);

  // Collapsed-mode: track which moderator's quick menu is open
  const [openCollapsedMod, setOpenCollapsedMod] = React.useState<string | number | null>(null);

  // Resize handlers
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;

    // Create bound event handlers for this drag session
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      const minWidth = 56;
      const maxWidth = 400;
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setCustomWidth(constrainedWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Snapping logic happens after drag ends
      setCustomWidth(prev => {
        if (prev !== null) {
          if (prev < 74) return 56;
          if (prev < 172) return 192;
        }
        return prev;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Helper: queues for current moderator (when logged in as moderator) or user (when logged in as user)
  const moderatorQueues = React.useMemo(() => {
    if ((!isModerator && !isUser) || !user) return [];

    if (isModerator) {
      // Moderator: filter queues where ModeratorId == user.id
      const uid = user.id?.toString();
      const uname = user.username?.toString();
      // Match by user id primarily; keep username fallback for legacy/sample data
      const list = queues.filter(q => q.moderatorId === uid || q.moderatorId === uname);
      // Minimal debug to help diagnose if still empty
      if (process.env.NODE_ENV !== 'production' && list.length === 0) {
        logger.debug('[ModeratorQueues] No queues matched for moderator', {
          userId: uid,
          username: uname,
          queueModeratorIds: queues.map(q => q.moderatorId).slice(0, 10),
          totalQueues: queues.length,
        });
      }
      return list;
    } else if (isUser) {
      // User: filter queues where ModeratorId == user.assignedModerator
      if (!user.assignedModerator) return [];
      const moderatorId = user.assignedModerator.toString();
      return queues.filter(q => q.moderatorId === moderatorId);
    }

    return [];
  }, [isModerator, isUser, user, queues]);

  const isQueueSelected = selectedQueueId !== null;

  const handleEditQueue = (queueId: string) => {
    const queue = queues.find((q) => q.id === queueId);
    if (queue) {
      openModal('editQueue', { queue });
    }
  };

  const handleDeleteQueue = async (queueId: string) => {
    const queue = queues.find((q) => q.id === queueId);
    const isConfirmed = await confirm(createDeleteConfirmation(`${queue?.doctorName || 'العيادة'}`));
    if (isConfirmed) {
      try {
        await queuesApiClient.deleteQueue(Number(queueId));
        addToast('تم حذف العيادة بنجاح', 'success');

        // Select another queue if this one was selected
        if (selectedQueueId === queueId && queues.length > 1) {
          const otherQueue = queues.find((q) => q.id !== queueId);
          if (otherQueue) {
            setSelectedQueueId(otherQueue.id);
          }
        } else if (queues.length === 1) {
          // setCurrentPanel will handle clearing queue selection internally
          setCurrentPanel('welcome');
        }

        // Refresh queues list
        await refreshQueues();
      } catch (error: any) {
        logger.error('Error deleting queue:', error);
        addToast(error?.message || 'فشل حذف العيادة', 'error');
      }
    }
  };

  // Prevent rendering until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return (
      <div className="w-1/4 bg-white shadow-lg border-l border-gray-200 flex flex-col animate-pulse">
        <div className="h-12 border-b border-gray-200 bg-gray-100"></div>
        <div className="p-4 space-y-2 flex-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: customWidth ? `${customWidth}px` : undefined,
        '--sidebar-width': customWidth ? `${customWidth}px` : (isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-expanded-width)')
      } as React.CSSProperties}
      className={`
      fixed right-0 top-20 md:top-24 bg-white shadow-lg border-l border-gray-200 flex flex-col z-30
      transition-all ${isResizing.current ? '' : 'duration-300 ease-in-out'} overflow-hidden
      h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] group
      ${customWidth ? '' : (isCollapsed ? 'w-14 sm:w-16' : 'w-96')}
    `}
      data-sidebar-width={customWidth || (isCollapsed ? 56 : 400)}
    >
      {/* Loading overlay when queues are loading */}
      {queuesLoading && (
        <div className="absolute inset-0 z-50 bg-white/70 flex items-center justify-center">
          <LoadingSpinner size="md" label="جاري التحميل..." variant="primary" centered={false} />
        </div>
      )}
      {/* Resize Handle - Left edge (RTL) */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-40"
        title="Drag to resize sidebar"
      />
      {/* Header with Toggle - Fixed (sticky) at top */}
      <div className="flex-shrink-0">
        <SidebarHeader isCollapsed={isIconOnly} onToggle={handleToggleCollapse} />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">

        {/* Main Navigation */}
        <nav className={`border-b border-gray-200 flex-shrink-0 overflow-hidden ${isCollapsed ? 'p-1' : 'px-2 py-3 sm:px-3 md:px-4'}`}>
          <ul className={`${isCollapsed ? 'space-y-1' : 'space-y-2'}`}>
            <li>
              <NavigationItem
                icon="fa-comments"
                label="الرسائل"
                isActive={!isQueueSelected && currentPanel === 'messages'}
                isCollapsed={isCollapsed}
                onClick={() => {
                  // setCurrentPanel will handle clearing queue selection internally
                  setCurrentPanel('messages');
                }}
              />
            </li>
            <li>
              <NavigationItem
                icon="fa-cog"
                label="الإدارة"
                isActive={!isQueueSelected && currentPanel === 'management'}
                isCollapsed={isCollapsed}
                onClick={() => {
                  // Authentication check before navigating to management
                  if (!isAuthenticated || !user) {
                    addToast('يجب تسجيل الدخول للوصول إلى إدارة المستخدمين', 'error');
                    return;
                  }
                  // setCurrentPanel will handle clearing queue selection internally
                  setCurrentPanel('management');
                }}
              />
            </li>

          </ul>
        </nav>

        {/* Docked Task Panels - Show for moderator/user views (not admin) */}
        {!isAdmin && !isCollapsed && (
          <nav
            className="p-4 border-b border-gray-200 bg-gradient-to-b from-blue-50 to-white flex-shrink-0"
            role="tablist"
          >
            <div className="space-y-2">
              <TabItem
                icon="fa-spinner"
                label="المهام الجارية"
                isActive={currentPanel === 'ongoing'}
                badge={taskPanelBadges.ongoing}
                pulse={isActivelySending}
                onClick={() => {
                  resetBadge('ongoing');
                  setCurrentPanel('ongoing');
                }}
              />
              <TabItem
                icon="fa-exclamation-circle"
                label="المهام الفاشلة"
                isActive={currentPanel === 'failed'}
                badge={taskPanelBadges.failed}
                onClick={() => {
                  resetBadge('failed');
                  setCurrentPanel('failed');
                }}
              />
              <TabItem
                icon="fa-check-circle"
                label="المهام المكتملة"
                isActive={currentPanel === 'completed'}
                badge={taskPanelBadges.completed}
                onClick={() => {
                  resetBadge('completed');
                  setCurrentPanel('completed');
                }}
              />
            </div>
          </nav>
        )}

        {/* Queues / Moderators Panel - Expanded */}
        {!isCollapsed && (
          <div className="px-2 sm:px-3 md:px-4 py-3 border-t border-gray-200 flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 overflow-hidden min-w-0">
              <h3 className="font-bold text-gray-800 text-xs sm:text-sm uppercase tracking-wide truncate">

                {isAdmin ? 'المشرفون والعيادات' : 'العيادات'}
              </h3>
              {/* Global add button removed for admins per new rule; all roles can still add via contextual buttons */}
              {!isAdmin && (
                <button
                  onClick={() => openModal('addQueue')}
                  title={'إضافة عيادة جديدة'}
                  aria-label="Add new queue"
                  className="
                  bg-gradient-to-r from-blue-600 to-blue-700 text-white w-8 h-8 rounded-full
                  hover:from-blue-700 hover:to-blue-800 transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  hover:shadow-md active:scale-95
                "
                >
                  <i className="fas fa-plus text-xs"></i>
                </button>
              )}
            </div>

            {/* Admin view: group queues by moderator */}
            {isAdmin && (
              <div className="space-y-3 flex-1">
                {/* Check if there are any moderators first */}
                {moderators.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-2">
                    <i className="fas fa-users-slash text-4xl text-gray-300 mb-3"></i>
                    <p className="text-xs text-gray-700 font-semibold mb-2">لا يوجد مشرفون</p>
                    <p className="text-xs text-gray-500 mb-3">يجب إنشاء مشرف أولاً لإضافة عيادات مرتبطة به</p>
                    <button
                      onClick={() => {
                        // Authentication check before navigating to management
                        if (!isAuthenticated || !user) {
                          addToast('يجب تسجيل الدخول للوصول إلى إدارة المستخدمين', 'error');
                          return;
                        }
                        setCurrentPanel('management');
                      }}
                      title="انتقل لإدارة المستخدمين"
                      className="
                      text-xs bg-blue-600 text-white px-3 py-1.5 rounded
                      hover:bg-blue-700 transition-colors
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    "
                    >
                      <i className="fas fa-user-plus mr-1"></i>
                      إدارة المستخدمين
                    </button>
                  </div>
                ) : (
                  moderators.map(mod => {
                    const isExpanded = expandedModerators.has(mod.moderatorId);
                    return (
                      <div
                        key={String(mod.moderatorId)}
                        className="border border-gray-200 rounded-lg bg-white overflow-hidden hover:border-blue-300 transition-colors min-w-0"
                      >
                        {/* Moderator header tile */}
                        <button
                          onClick={() => toggleModeratorExpanded(mod.moderatorId)}
                          className="w-full text-right px-2 sm:px-3 py-2 sm:py-3 flex items-center gap-1 sm:gap-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden min-w-0"
                          aria-label={`المشرف ${mod.moderatorName}`}
                        >
                          <i className={`fas fa-chevron-down text-gray-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}></i>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="font-semibold text-xs sm:text-sm text-gray-900 flex items-center gap-1 truncate">
                              <i className="fas fa-user-tie text-purple-600 flex-shrink-0"></i>

                              {mod.moderatorName}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">@{mod.moderatorUsername}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0 sm:flex-row flex-col-reverse sm:items-center items-end">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium" title="عدد العيادات">
                              <span className="mr-1">🏥</span>
                              <span>{mod.queuesCount}</span>
                              <span className="hidden xl:inline">
                                &nbsp;عيادة
                              </span>
                            </span>
                            {mod.conflictCount > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold" title="عدد التضاربات">
                                ⛔ {mod.conflictCount}
                              </span>
                            )}
                            {/* Add queue for this moderator (use non-button inside a button to avoid nested <button>) */}
                            <span
                              role="button"
                              tabIndex={0}
                              className="inline-flex items-center gap-1 px-1.5 xl:px-2 py-1 bg-green-600 text-white rounded text-[11px] hover:bg-green-700 transition-colors cursor-pointer flex-shrink-0 w-auto"
                              title="إضافة عيادة لهذا المشرف"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal('addQueue', { moderatorId: mod.moderatorId });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openModal('addQueue', { moderatorId: mod.moderatorId });
                                }
                              }}
                              aria-label={`إضافة عيادة للمشرف ${mod.moderatorName}`}
                            >
                              <i className="fas fa-plus" aria-hidden="true"></i>
                              <span className="hidden xl:inline">إضافة عيادة</span>
                            </span>
                          </div>
                        </button>
                        {/* Task panels and queues under moderator */}
                        {isExpanded && (
                          <>
                            {/* Docked task panels for this moderator */}
                            <div className="border-t border-gray-100 bg-gradient-to-b from-blue-50 to-white p-2">
                              <div className="space-y-1">
                                {/* Check if this moderator's task panels are active */}
                                {(() => {
                                  const selectedQueue = selectedQueueId ? queues.find(q => String(q.id) === String(selectedQueueId)) : null;
                                  const isThisModeratorActiveViaQueue = selectedQueue && String(selectedQueue.moderatorId) === String(mod.moderatorId);
                                  // Moderator is active if their queue is selected OR they were explicitly selected
                                  const isThisModeratorActive = isThisModeratorActiveViaQueue || String(selectedModeratorId) === String(mod.moderatorId);

                                  return (
                                    <>
                                      <TabItem
                                        icon="fa-spinner"
                                        label="المهام الجارية"
                                        isActive={isThisModeratorActive && currentPanel === 'ongoing'}
                                        badge={taskPanelBadges.ongoing}
                                        pulse={isActivelySending}
                                        onClick={(e) => {
                                          e?.stopPropagation?.();
                                          resetBadge('ongoing');
                                          // Always track which moderator's panel was clicked
                                          setSelectedModeratorId(mod.moderatorId);
                                          // If moderator has queues and no queue selected, select first queue
                                          if (mod.queues && mod.queues.length > 0 && !isThisModeratorActiveViaQueue) {
                                            setSelectedQueueId(mod.queues[0].id);
                                          }
                                          setCurrentPanel('ongoing');
                                        }}
                                      />
                                      <TabItem
                                        icon="fa-exclamation-circle"
                                        label="المهام الفاشلة"
                                        isActive={isThisModeratorActive && currentPanel === 'failed'}
                                        badge={taskPanelBadges.failed}
                                        onClick={(e) => {
                                          e?.stopPropagation?.();
                                          resetBadge('failed');
                                          // Always track which moderator's panel was clicked
                                          setSelectedModeratorId(mod.moderatorId);
                                          // If moderator has queues and no queue selected, select first queue
                                          if (mod.queues && mod.queues.length > 0 && !isThisModeratorActiveViaQueue) {
                                            setSelectedQueueId(mod.queues[0].id);
                                          }
                                          setCurrentPanel('failed');
                                        }}
                                      />
                                      <TabItem
                                        icon="fa-check-circle"
                                        label="المهام المكتملة"
                                        isActive={isThisModeratorActive && currentPanel === 'completed'}
                                        badge={taskPanelBadges.completed}
                                        onClick={(e) => {
                                          e?.stopPropagation?.();
                                          resetBadge('completed');
                                          // Always track which moderator's panel was clicked
                                          setSelectedModeratorId(mod.moderatorId);
                                          // If moderator has queues and no queue selected, select first queue
                                          if (mod.queues && mod.queues.length > 0 && !isThisModeratorActiveViaQueue) {
                                            setSelectedQueueId(mod.queues[0].id);
                                          }
                                          setCurrentPanel('completed');
                                        }}
                                      />
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="border-t border-gray-100 bg-gray-50 p-1 space-y-0.5 overflow-hidden min-w-0">
                              {mod.queues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center px-2">
                                  <i className="fas fa-hospital text-3xl text-gray-300 mb-2"></i>
                                  <p className="text-xs text-gray-700 font-semibold mb-1">لا توجد عيادات</p>
                                  <p className="text-xs text-gray-500 mb-3">لا توجد عيادات مرتبطة بهذا المشرف</p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openModal('addQueue', { moderatorId: mod.moderatorId });
                                    }}
                                    title="إضافة عيادة لهذا المشرف"
                                    className="
                                  text-xs bg-green-600 text-white px-3 py-1.5 rounded
                                  hover:bg-green-700 transition-colors
                                  focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                                "
                                  >
                                    <i className="fas fa-plus mr-1"></i>
                                    إضافة عيادة
                                  </button>
                                </div>
                              ) : (
                                mod.queues.map(q => (
                                  <QueueListItem
                                    key={q.id}
                                    id={q.id}
                                    doctorName={q.doctorName}
                                    isSelected={selectedQueueId === q.id && currentPanel === 'welcome'}
                                    isCollapsed={false}
                                    onClick={() => {
                                      // setSelectedQueueId will handle navigation to /queues/${id}
                                      // Don't set panel here - let the queue selection handle it
                                      setSelectedQueueId(q.id);
                                    }}
                                    onEdit={handleEditQueue}
                                    onDelete={handleDeleteQueue}
                                  />
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Moderator/self view: show only own queues */}
            {isModerator && !isAdmin && (
              <div className="space-y-2 flex-1">
                {moderatorQueues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <i className="fas fa-inbox text-4xl text-gray-300 mb-2"></i>
                    <p className="text-xs text-gray-500">لا توجد عيادات</p>
                  </div>
                ) : (
                  moderatorQueues.map(queue => (
                    <QueueListItem
                      key={queue.id}
                      id={queue.id}
                      doctorName={queue.doctorName}
                      isSelected={selectedQueueId === queue.id && currentPanel === 'welcome'}
                      isCollapsed={false}
                      onClick={() => {
                        // setSelectedQueueId will handle navigation to /queues/${id}
                        // The URL sync will automatically set panel to 'welcome' for queue routes
                        setSelectedQueueId(queue.id);
                      }}
                      onEdit={handleEditQueue}
                      onDelete={handleDeleteQueue}
                    />
                  ))
                )}
              </div>
            )}

            {/* Regular user (non-admin, non-moderator) fallback: show all queues flat */}
            {!isAdmin && !isModerator && (
              <div className="space-y-2 flex-1">
                {queues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <i className="fas fa-inbox text-4xl text-gray-300 mb-2"></i>
                    <p className="text-xs text-gray-500">لا توجد عيادات</p>
                  </div>
                ) : (
                  queues.map(queue => (
                    <QueueListItem
                      key={queue.id}
                      id={queue.id}
                      doctorName={queue.doctorName}
                      isSelected={selectedQueueId === queue.id && currentPanel === 'welcome'}
                      isCollapsed={false}
                      onClick={() => {
                        // setSelectedQueueId will handle navigation to /queues/${id}
                        // The URL sync will automatically set panel to 'welcome' for queue routes
                        setSelectedQueueId(queue.id);
                      }}
                      onEdit={handleEditQueue}
                      onDelete={handleDeleteQueue}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed sidebar variant */}
        {isCollapsed && (
          <div className="p-2 border-t border-gray-200 flex-1 flex flex-col">
            {/* Collapsed: docked task panel icons for moderator/user views */}
            {!isAdmin && (
              <div className="flex flex-col items-center gap-2 mb-2 px-1 border-b border-gray-200 pb-2">
                <button
                  onClick={() => {
                    resetBadge('ongoing');
                    setCurrentPanel('ongoing');
                  }}
                  title="المهام الجارية"
                  aria-label="المهام الجارية"
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'ongoing' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'} ${isActivelySending ? 'animate-pulse ring-2 ring-blue-400' : ''}`}
                >
                  <i className="fas fa-spinner text-xs"></i>
                  {/* Badge for collapsed view */}
                  {taskPanelBadges.ongoing > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
                      {taskPanelBadges.ongoing > 9 ? '9+' : taskPanelBadges.ongoing}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    resetBadge('failed');
                    setCurrentPanel('failed');
                  }}
                  title="المهام الفاشلة"
                  aria-label="المهام الفاشلة"
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'failed' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                >
                  <i className="fas fa-exclamation-circle text-xs"></i>
                  {/* Badge for collapsed view */}
                  {taskPanelBadges.failed > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
                      {taskPanelBadges.failed > 9 ? '9+' : taskPanelBadges.failed}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    resetBadge('completed');
                    setCurrentPanel('completed');
                  }}
                  title="المهام المكتملة"
                  aria-label="المهام المكتملة"
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'completed' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
                >
                  <i className="fas fa-check-circle text-xs"></i>
                  {/* Badge for collapsed view */}
                  {taskPanelBadges.completed > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
                      {taskPanelBadges.completed > 9 ? '9+' : taskPanelBadges.completed}
                    </span>
                  )}
                </button>
              </div>
            )}
            {/* Global add button removed for admins; non-admins retain it */}
            {!isAdmin && (
              <button
                onClick={() => openModal('addQueue')}
                title={'إضافة عيادة جديدة'}
                aria-label="Add new queue"
                className="
                w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-2 rounded-lg
                hover:from-blue-700 hover:to-blue-800 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                hover:shadow-md active:scale-95 mb-2
              "
              >
                <i className="fas fa-plus text-sm"></i>
              </button>
            )}

            <div className="space-y-1 flex-1">
              {/* Admin collapsed: show empty state or moderators icons */}
              {isAdmin && (
                moderators.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center px-2">
                    <i className="fas fa-users-slash text-3xl text-gray-300 mb-2"></i>
                    <p className="text-[10px] text-gray-700 font-semibold mb-1">لا يوجد مشرفون</p>
                    <p className="text-[9px] text-gray-500 mb-2">يجب إنشاء مشرف أولاً</p>
                    <button
                      onClick={() => {
                        // Authentication check before navigating to management
                        if (!isAuthenticated || !user) {
                          addToast('يجب تسجيل الدخول للوصول إلى إدارة المستخدمين', 'error');
                          return;
                        }
                        setCurrentPanel('management');
                      }}
                      title="انتقل لإدارة المستخدمين"
                      className="
                      text-[10px] bg-blue-600 text-white px-2 py-1 rounded
                      hover:bg-blue-700 transition-colors
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    "
                    >
                      <i className="fas fa-user-plus mr-1"></i>
                      إدارة المستخدمين
                    </button>
                  </div>
                ) : (
                  moderators.map(mod => (
                    <div
                      key={String(mod.moderatorId)}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-gray-100 cursor-pointer relative"
                      onClick={() => {
                        // Toggle quick menu for this moderator in collapsed mode
                        setOpenCollapsedMod(prev => (prev === mod.moderatorId ? null : mod.moderatorId));
                      }}
                    >
                      {/* Collapsed: per-moderator add (+) visible as corner button */}
                      <button
                        className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shadow hover:bg-green-700"
                        title="إضافة عيادة"
                        aria-label={`إضافة عيادة للمشرف ${mod.moderatorName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal('addQueue', { moderatorId: mod.moderatorId });
                        }}
                      >
                        <i className="fas fa-plus text-[10px]"></i>
                      </button>
                      <i className={`fas fa-user-tie text-purple-600 ${openCollapsedMod === mod.moderatorId ? 'opacity-100' : 'opacity-80'}`}></i>
                      <span className="text-[10px] text-gray-700 font-medium truncate max-w-full" title={mod.moderatorName}>{mod.moderatorName.split(' ')[0]}</span>
                      <span className="text-[9px] text-blue-600" title="عدد العيادات">{mod.queuesCount}</span>

                      {/* Quick access queues grid when collapsed - no internal scroll */}
                      {openCollapsedMod === mod.moderatorId && mod.queues && mod.queues.length > 0 && (
                        <div className="w-full mt-1 bg-white border border-gray-200 rounded-lg shadow p-2 z-20" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-1">
                            {mod.queues.map(q => (
                              <button
                                key={q.id}
                                title={q.doctorName}
                                aria-label={`فتح العيادة: ${q.doctorName}`}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${selectedQueueId === q.id && currentPanel === 'welcome'
                                  ? 'bg-blue-100 ring-2 ring-blue-500'
                                  : 'bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-200'
                                  }`}
                                onClick={() => {
                                  // setSelectedQueueId will handle navigation to /queues/${id}
                                  // The URL sync will automatically set panel to 'welcome' for queue routes
                                  setSelectedQueueId(q.id);
                                  setOpenCollapsedMod(null);
                                }}
                              >
                                <i className="fas fa-hospital text-lg text-purple-600"></i>
                                <span className="text-[10px] text-gray-700 font-medium truncate max-w-full mt-1" title={q.doctorName}>
                                  {q.doctorName.split(' ')[0]}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}
              {/* Moderator collapsed: own queues */}
              {isModerator && !isAdmin && moderatorQueues.map(queue => (
                <QueueListItem
                  key={queue.id}
                  id={queue.id}
                  doctorName={queue.doctorName}
                  isSelected={selectedQueueId === queue.id && currentPanel === 'welcome'}
                  isCollapsed={isIconOnly}
                  onClick={() => {
                    setSelectedQueueId(queue.id);
                    setCurrentPanel('welcome');
                  }}
                  onEdit={handleEditQueue}
                  onDelete={handleDeleteQueue}
                />
              ))}
              {/* Regular user collapsed: all queues */}
              {!isAdmin && !isModerator && queues.map(queue => (
                <QueueListItem
                  key={queue.id}
                  id={queue.id}
                  doctorName={queue.doctorName}
                  isSelected={selectedQueueId === queue.id && currentPanel === 'welcome'}
                  isCollapsed={isIconOnly}
                  onClick={() => {
                    setSelectedQueueId(queue.id);
                    setCurrentPanel('welcome');
                  }}
                  onEdit={handleEditQueue}
                  onDelete={handleDeleteQueue}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


