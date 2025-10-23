'use client';

import { useQueue } from '../../contexts/QueueContext';
import { useUI } from '../../contexts/UIContext';
import { useModal } from '../../contexts/ModalContext';

export default function Navigation() {
  const { queues, selectedQueueId, setSelectedQueueId } = useQueue();
  const { currentPanel, setCurrentPanel } = useUI();
  const { openModal } = useModal();

  const isQueueSelected = selectedQueueId !== null;

  return (
    <div className="w-1/4 bg-white shadow-lg border-l border-gray-200 flex flex-col">
      {/* Main Navigation */}
      <nav className="p-4 border-b border-gray-200">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => {
                setCurrentPanel('messages');
                setSelectedQueueId(null);
              }}
              className={`nav-item w-full text-right px-4 py-3 rounded-lg transition-colors ${
                !isQueueSelected && currentPanel === 'messages'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>الرسائل</span>
                <i className="fas fa-comments"></i>
              </div>
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                setCurrentPanel('management');
                setSelectedQueueId(null);
              }}
              className={`nav-item w-full text-right px-4 py-3 rounded-lg transition-colors ${
                !isQueueSelected && currentPanel === 'management'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>الإدارة</span>
                <i className="fas fa-cog"></i>
              </div>
            </button>
          </li>
        </ul>
      </nav>

      {/* Queue Tabs - Show when queue is selected */}
      {isQueueSelected && (
        <nav className="p-4 border-b border-gray-200 bg-blue-50">
          <div className="space-y-2">
            <button
              onClick={() => setCurrentPanel('welcome')}
              className={`w-full text-right px-4 py-2 rounded-lg transition-colors text-sm ${
                currentPanel === 'welcome'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-100'
              }`}
            >
              <i className="fas fa-tachometer-alt ml-2"></i>
              لوحة التحكم الرئيسية
            </button>
            <button
              onClick={() => setCurrentPanel('ongoing')}
              className={`w-full text-right px-4 py-2 rounded-lg transition-colors text-sm ${
                currentPanel === 'ongoing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-100'
              }`}
            >
              <i className="fas fa-spinner ml-2"></i>
              المهام الجارية
            </button>
            <button
              onClick={() => setCurrentPanel('failed')}
              className={`w-full text-right px-4 py-2 rounded-lg transition-colors text-sm ${
                currentPanel === 'failed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-100'
              }`}
            >
              <i className="fas fa-exclamation-circle ml-2"></i>
              المهام الفاشلة
            </button>
            <button
              onClick={() => setCurrentPanel('done')}
              className={`w-full text-right px-4 py-2 rounded-lg transition-colors text-sm ${
                currentPanel === 'done'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-100'
              }`}
            >
              <i className="fas fa-check-circle ml-2"></i>
              المهام المكتملة
            </button>
          </div>
        </nav>
      )}

      {/* Queues Panel */}
      <div className="p-4 border-t border-gray-200 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">الطوابير</h3>
          <button 
            onClick={() => openModal('addQueue')}
            className="bg-blue-600 text-white w-8 h-8 rounded-full hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-plus text-sm"></i>
          </button>
        </div>

        <div className="space-y-2">
          {queues.map((queue) => (
            <button
              key={queue.id}
              onClick={() => {
                setSelectedQueueId(queue.id);
                setCurrentPanel('welcome');
              }}
              className={`w-full text-right px-4 py-3 rounded-lg transition-colors border-r-2 ${
                selectedQueueId === queue.id
                  ? 'bg-blue-50 border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="truncate">
                  <p className="font-medium">{queue.doctorName}</p>
                  {selectedQueueId === queue.id && (
                    <p className="text-xs text-gray-500 mt-1">طابور نشط</p>
                  )}
                </div>
                <i className="fas fa-hospital text-gray-400"></i>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
