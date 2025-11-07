'use client';

import { useQueue } from '../../contexts/QueueContext';
import { useUI } from '../../contexts/UIContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirmDialog } from '../../contexts/ConfirmationContext';
import { createDeleteConfirmation } from '../../utils/confirmationHelpers';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';
import { SidebarHeader } from './SidebarHeader';
import { NavigationItem } from './NavigationItem';
import { TabItem } from './TabItem';
import { QueueListItem } from './QueueListItem';

export default function Navigation() {
  const { queues, selectedQueueId, setSelectedQueueId } = useQueue();
  const { currentPanel, setCurrentPanel } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { isCollapsed, toggleCollapse, isHydrated } = useSidebarCollapse();

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

      {/* Queues Panel - Expanded */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 flex-1 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">الطوابير</h3>
            <button
              onClick={() => openModal('addQueue')}
              title="إضافة طابور جديد"
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
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto">
            {queues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <i className="fas fa-inbox text-4xl text-gray-300 mb-2"></i>
                <p className="text-xs text-gray-500">لا توجد طوابير</p>
              </div>
            ) : (
              queues.map((queue) => (
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
        </div>
      )}

      {/* Queues Panel - Collapsed */}
      {isCollapsed && (
        <div className="p-2 border-t border-gray-200 flex-1 overflow-y-auto flex flex-col">
          <button
            onClick={() => openModal('addQueue')}
            title="إضافة طابور جديد"
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

          <div className="space-y-1 flex-1 overflow-y-auto">
            {queues.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <i className="fas fa-inbox text-2xl text-gray-300"></i>
              </div>
            ) : (
              queues.map((queue) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
