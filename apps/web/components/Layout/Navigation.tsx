'use client';

import React from 'react';
import { useQueue } from '../../contexts/QueueContext';
import { useUI } from '../../contexts/UIContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirmDialog } from '../../contexts/ConfirmationContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/roles';
import { createDeleteConfirmation } from '../../utils/confirmationHelpers';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';
import { SidebarHeader } from './SidebarHeader';
import { NavigationItem } from './NavigationItem';
import { TabItem } from './TabItem';
import { QueueListItem } from './QueueListItem';

export default function Navigation() {
  const { queues, selectedQueueId, setSelectedQueueId, moderators } = useQueue();
  const { currentPanel, setCurrentPanel } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { isCollapsed, toggleCollapse, isHydrated } = useSidebarCollapse();
  const { user } = useAuth();

  // Custom width state for resizing
  const [customWidth, setCustomWidth] = React.useState<number | null>(null);
  const isResizing = React.useRef(false);
  const wasCollapsedByDrag = React.useRef(false); // Track if we collapsed due to dragging narrow
  
  // Detect icon-only mode: either collapsed via toggle OR dragged to narrow width (56px)
  const isIconOnly = isCollapsed || customWidth === 56;

  // Auto-collapse/expand based on width thresholds during drag
  // When collapsed: expand when width > 120px
  // When expanded: collapse when width < 80px
  React.useEffect(() => {
    if (customWidth !== null) {
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

  // Role flags
  const isPrimaryAdmin = user?.role === UserRole.PrimaryAdmin;
  const isSecondaryAdmin = user?.role === UserRole.SecondaryAdmin;
  const isAdmin = isPrimaryAdmin || isSecondaryAdmin; // Admin views get moderator grouping
  const isModerator = user?.role === UserRole.Moderator;

  // Expanded moderators state (admin view only)
  const [expandedModerators, setExpandedModerators] = React.useState<Set<string | number>>(new Set());
  const toggleModeratorExpanded = React.useCallback((moderatorId: string | number) => {
    setExpandedModerators(prev => {
      const next = new Set(prev);
      if (next.has(moderatorId)) next.delete(moderatorId); else next.add(moderatorId);
      return next;
    });
  }, []);

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

  // Helper: queues for current moderator (when logged in as moderator)
  const moderatorQueues = React.useMemo(() => {
    if (!isModerator || !user) return [];
    const uid = user.id?.toString();
    const uname = user.username?.toString();
    // Match by user id primarily; keep username fallback for legacy/sample data
    const list = queues.filter(q => q.moderatorId === uid || q.moderatorId === uname);
    // Minimal debug to help diagnose if still empty
    if (process.env.NODE_ENV !== 'production' && list.length === 0) {
      console.debug('[ModeratorQueues] No queues matched for moderator', {
        userId: uid,
        username: uname,
        queueModeratorIds: queues.map(q => q.moderatorId).slice(0, 10),
        totalQueues: queues.length,
      });
    }
    return list;
  }, [isModerator, user, queues]);

  const isQueueSelected = selectedQueueId !== null;

  const handleEditQueue = (queueId: string) => {
    const queue = queues.find((q) => q.id === queueId);
    if (queue) {
      openModal('editQueue', { queue });
    }
  };

  const handleDeleteQueue = async (queueId: string) => {
    const queue = queues.find((q) => q.id === queueId);
    const isConfirmed = await confirm(createDeleteConfirmation(`${queue?.doctorName || 'الطابور'}`));
    if (isConfirmed) {
      // TODO: Implement delete queue API call
      // For now, just select another queue if this one was selected
      if (selectedQueueId === queueId && queues.length > 1) {
        const otherQueue = queues.find((q) => q.id !== queueId);
        if (otherQueue) {
          setSelectedQueueId(otherQueue.id);
        }
      } else if (queues.length === 1) {
        setSelectedQueueId(null);
        setCurrentPanel('welcome');
      }
      // TODO: Call API to delete queue
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
      transition-all ${isResizing.current ? '' : 'duration-300 ease-in-out'} overflow-y-auto
      h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] group
      ${customWidth ? '' : (isCollapsed ? 'w-14 sm:w-16' : 'w-48 sm:w-56 md:w-64 lg:w-72')}
    `}
      data-sidebar-width={customWidth || (isCollapsed ? 56 : 192)}
    >
      {/* Resize Handle - Left edge (RTL) */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-40"
        title="Drag to resize sidebar"
      />
      {/* Header with Toggle */}
      <SidebarHeader isCollapsed={isIconOnly} onToggle={handleToggleCollapse} />

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
                setCurrentPanel('messages');
                setSelectedQueueId(null);
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
                setCurrentPanel('management');
                setSelectedQueueId(null);
              }}
            />
          </li>
        </ul>
      </nav>

      {/* Queue Tabs - Show when queue is selected */}
      {isQueueSelected && !isCollapsed && (
        <nav
          className="p-4 border-b border-gray-200 bg-gradient-to-b from-blue-50 to-white flex-shrink-0"
          role="tablist"
        >
          <div className="space-y-2">
            <TabItem
              icon="fa-tachometer-alt"
              label="لوحة التحكم الرئيسية"
              isActive={currentPanel === 'welcome'}
              onClick={() => setCurrentPanel('welcome')}
            />
            <TabItem
              icon="fa-spinner"
              label="المهام الجارية"
              isActive={currentPanel === 'ongoing'}
              onClick={() => setCurrentPanel('ongoing')}
            />
            <TabItem
              icon="fa-exclamation-circle"
              label="المهام الفاشلة"
              isActive={currentPanel === 'failed'}
              onClick={() => setCurrentPanel('failed')}
            />
            <TabItem
              icon="fa-check-circle"
              label="المهام المكتملة"
              isActive={currentPanel === 'done'}
              onClick={() => setCurrentPanel('done')}
            />
          </div>
        </nav>
      )}

      {/* Queues / Moderators Panel - Expanded */}
      {!isCollapsed && (
        <div className="px-2 sm:px-3 md:px-4 py-3 border-t border-gray-200 flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 overflow-hidden min-w-0">
            <h3 className="font-bold text-gray-800 text-xs sm:text-sm uppercase tracking-wide truncate">

              {isAdmin ? 'المشرفون والطوابير' : 'الطوابير'}
            </h3>
            {/* Global add button removed for admins per new rule; all roles can still add via contextual buttons */}
            {!isAdmin && (
              <button
                onClick={() => openModal('addQueue')}
                title={'إضافة طابور جديد'}
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
              {moderators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-2">
                  <i className="fas fa-users-slash text-4xl text-gray-300 mb-3"></i>
                  <p className="text-xs text-gray-700 font-semibold mb-2">لا يوجد مشرفون</p>
                  <p className="text-xs text-gray-500 mb-3">يجب إنشاء مشرف أولاً لإضافة طوابير مرتبطة به</p>
                  <button
                    onClick={() => setCurrentPanel('management')}
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
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium" title="عدد الطوابير">
                            <span className="mr-1">🏥</span>
                            <span>{mod.queuesCount}</span>
                            <span className="hidden xl:inline">
                              &nbsp;طابور
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
                            title="إضافة طابور لهذا المشرف"
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
                            aria-label={`إضافة طابور للمشرف ${mod.moderatorName}`}
                          >
                            <i className="fas fa-plus" aria-hidden="true"></i>
                            <span className="hidden xl:inline">إضافة طابور</span>
                          </span>
                        </div>
                      </button>
                      {/* Queues under moderator */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-1 space-y-0.5 overflow-hidden min-w-0">
                          {mod.queues.length === 0 ? (
                            <p className="text-xs text-gray-500 px-2 py-1">لا توجد طوابير</p>
                          ) : (
                            mod.queues.map(q => (
                              <QueueListItem
                                key={q.id}
                                id={q.id}
                                doctorName={q.doctorName}
                                isSelected={selectedQueueId === q.id}
                                isCollapsed={false}
                                onClick={() => {
                                  setSelectedQueueId(q.id);
                                  setCurrentPanel('welcome');
                                }}
                                onEdit={handleEditQueue}
                                onDelete={handleDeleteQueue}
                              />
                            ))
                          )}
                        </div>
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
                  <p className="text-xs text-gray-500">لا توجد طوابير</p>
                </div>
              ) : (
                moderatorQueues.map(queue => (
                  <QueueListItem
                    key={queue.id}
                    id={queue.id}
                    doctorName={queue.doctorName}
                    isSelected={selectedQueueId === queue.id}
                    isCollapsed={false}
                    onClick={() => {
                      setSelectedQueueId(queue.id);
                      setCurrentPanel('welcome');
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
                  <p className="text-xs text-gray-500">لا توجد طوابير</p>
                </div>
              ) : (
                queues.map(queue => (
                  <QueueListItem
                    key={queue.id}
                    id={queue.id}
                    doctorName={queue.doctorName}
                    isSelected={selectedQueueId === queue.id}
                    isCollapsed={false}
                    onClick={() => {
                      setSelectedQueueId(queue.id);
                      setCurrentPanel('welcome');
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
          {/* Collapsed: quick tab icons when a queue is selected */}
          {isQueueSelected && (
            <div className="flex flex-col items-center gap-2 mb-2 px-1">
              <button
                onClick={() => setCurrentPanel('welcome')}
                title="لوحة التحكم الرئيسية"
                aria-label="لوحة التحكم الرئيسية"
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'welcome' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
              >
                <i className="fas fa-tachometer-alt text-xs"></i>
              </button>
              <button
                onClick={() => setCurrentPanel('ongoing')}
                title="المهام الجارية"
                aria-label="المهام الجارية"
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'ongoing' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
              >
                <i className="fas fa-spinner text-xs"></i>
              </button>
              <button
                onClick={() => setCurrentPanel('failed')}
                title="المهام الفاشلة"
                aria-label="المهام الفاشلة"
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'failed' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
              >
                <i className="fas fa-exclamation-circle text-xs"></i>
              </button>
              <button
                onClick={() => setCurrentPanel('done')}
                title="المهام المكتملة"
                aria-label="المهام المكتملة"
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${currentPanel === 'done' ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'}`}
              >
                <i className="fas fa-check-circle text-xs"></i>
              </button>
            </div>
          )}
          {/* Global add button removed for admins; non-admins retain it */}
          {!isAdmin && (
            <button
              onClick={() => openModal('addQueue')}
              title={'إضافة طابور جديد'}
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
            {/* Admin collapsed: show moderators icons (no add buttons) */}
            {isAdmin && moderators.length > 0 && (
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
                    title="إضافة طابور"
                    aria-label={`إضافة طابور للمشرف ${mod.moderatorName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal('addQueue', { moderatorId: mod.moderatorId });
                    }}
                  >
                    <i className="fas fa-plus text-[10px]"></i>
                  </button>
                  <i className={`fas fa-user-tie text-purple-600 ${openCollapsedMod === mod.moderatorId ? 'opacity-100' : 'opacity-80'}`}></i>
                  <span className="text-[10px] text-gray-700 font-medium truncate max-w-full" title={mod.moderatorName}>{mod.moderatorName.split(' ')[0]}</span>
                  <span className="text-[9px] text-blue-600" title="عدد الطوابير">{mod.queuesCount}</span>

                  {/* Quick access queues grid when collapsed - no internal scroll */}
                  {openCollapsedMod === mod.moderatorId && mod.queues && mod.queues.length > 0 && (
                    <div className="w-full mt-1 bg-white border border-gray-200 rounded-lg shadow p-2 z-20" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 gap-1">
                        {mod.queues.map(q => (
                          <button
                            key={q.id}
                            title={q.doctorName}
                            aria-label={`فتح الطابور: ${q.doctorName}`}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                              selectedQueueId === q.id 
                                ? 'bg-blue-100 ring-2 ring-blue-500' 
                                : 'bg-gray-50 hover:bg-gray-100 ring-1 ring-gray-200'
                            }`}
                            onClick={() => {
                              setSelectedQueueId(q.id);
                              setCurrentPanel('welcome');
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
            )}
            {/* Moderator collapsed: own queues */}
            {isModerator && !isAdmin && moderatorQueues.map(queue => (
              <QueueListItem
                key={queue.id}
                id={queue.id}
                doctorName={queue.doctorName}
                isSelected={selectedQueueId === queue.id}
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
                isSelected={selectedQueueId === queue.id}
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
  );
}
