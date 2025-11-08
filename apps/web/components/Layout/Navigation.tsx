'use client';

import React from 'react';
import { useQueue } from '../../contexts/QueueContext';
import { useUI } from '../../contexts/UIContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirmDialog } from '../../contexts/ConfirmationContext';
import { useAuth } from '../../contexts/AuthContext';
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

  // Role flags
  const isPrimaryAdmin = user?.role === 'primary_admin';
  const isSecondaryAdmin = user?.role === 'secondary_admin';
  const isAdmin = isPrimaryAdmin || isSecondaryAdmin; // Admin views get moderator grouping
  const isModerator = user?.role === 'moderator';

  // Expanded moderators state (admin view only)
  const [expandedModerators, setExpandedModerators] = React.useState<Set<string | number>>(new Set());
  const toggleModeratorExpanded = React.useCallback((moderatorId: string | number) => {
    setExpandedModerators(prev => {
      const next = new Set(prev);
      if (next.has(moderatorId)) next.delete(moderatorId); else next.add(moderatorId);
      return next;
    });
  }, []);

  // Helper: queues for current moderator (when logged in as moderator)
  const moderatorQueues = React.useMemo(() => {
    if (!isModerator || !user) return [];
    // SAMPLE_QUEUES uses moderatorId like 'mod1', moderator user credentials username is 'mod1'
    return queues.filter(q => q.moderatorId === user.username);
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
    <div className={`
      bg-white shadow-lg border-l border-gray-200 flex flex-col
      transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-20' : 'w-1/4'}
    `}
    >
      {/* Header with Toggle */}
      <SidebarHeader isCollapsed={isCollapsed} onToggle={toggleCollapse} />

      {/* Main Navigation */}
      <nav className={`border-b border-gray-200 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <ul className="space-y-2">
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
          className="p-4 border-b border-gray-200 bg-gradient-to-b from-blue-50 to-white"
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
        <div className="p-4 border-t border-gray-200 flex-1 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
              {isAdmin ? 'المشرفون والطوابير' : 'الطوابير'}
            </h3>
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
            <div className="space-y-3 flex-1 overflow-y-auto">
              {moderators.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <i className="fas fa-users-slash text-4xl text-gray-300 mb-2"></i>
                  <p className="text-xs text-gray-500">لا يوجد مشرفون</p>
                </div>
              ) : (
                moderators.map(mod => {
                  const isExpanded = expandedModerators.has(mod.moderatorId);
                  return (
                    <div
                      key={String(mod.moderatorId)}
                      className="border border-gray-200 rounded-lg bg-white overflow-hidden hover:border-blue-300 transition-colors"
                    >
                      {/* Moderator header tile */}
                      <button
                        onClick={() => toggleModeratorExpanded(mod.moderatorId)}
                        className="w-full text-right px-3 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`المشرف ${mod.moderatorName}`}
                      >
                        <i className={`fas fa-chevron-down text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                            <i className="fas fa-user-tie text-purple-600"></i>
                            {mod.moderatorName}
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">@{mod.moderatorUsername}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium" title="عدد الطوابير">
                            🏥 {mod.queuesCount} طابور
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
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-[11px] hover:bg-green-700 transition-colors cursor-pointer"
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
                            <i className="fas fa-plus"></i>
                            إضافة طابور
                          </span>
                        </div>
                      </button>
                      {/* Queues under moderator */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 p-2 space-y-1">
                          {mod.queues.length === 0 ? (
                            <p className="text-xs text-gray-500 px-2 py-1">لا توجد طوابير لهذا المشرف</p>
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
            <div className="space-y-2 flex-1 overflow-y-auto">
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
            <div className="space-y-2 flex-1 overflow-y-auto">
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
        <div className="p-2 border-t border-gray-200 flex-1 overflow-y-auto flex flex-col">
          {/* Only show global add button when NOT admin */}
          {!isAdmin && (
            <button
              onClick={() => openModal('addQueue')}
              title={isModerator ? 'إضافة طابور جديد' : 'إضافة طابور جديد'}
              aria-label="Add new queue"
              className="
                w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-2.5 rounded-lg
                hover:from-blue-700 hover:to-blue-800 transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                hover:shadow-md active:scale-95 mb-2
              "
            >
              <i className="fas fa-plus text-sm"></i>
            </button>
          )}

          <div className="space-y-1 flex-1 overflow-y-auto">
            {/* Admin collapsed: show moderators icons (no add buttons) */}
            {isAdmin && moderators.length > 0 && (
              moderators.map(mod => (
                <div
                  key={String(mod.moderatorId)}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => toggleModeratorExpanded(mod.moderatorId)}
                >
                  <i className={`fas fa-user-tie text-purple-600 ${expandedModerators.has(mod.moderatorId) ? 'opacity-100' : 'opacity-80'}`}></i>
                  <span className="text-[10px] text-gray-700 font-medium truncate max-w-full" title={mod.moderatorName}>{mod.moderatorName.split(' ')[0]}</span>
                  <span className="text-[9px] text-blue-600" title="عدد الطوابير">{mod.queuesCount}</span>
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
                isCollapsed={true}
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
                isCollapsed={true}
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
