'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { messageApiClient } from '@/services/api/messageApiClient';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';

interface RetryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sessionId: string;
}

interface RetryPreviewData {
  retryable: {
    count: number;
    reasons: Array<{ reason: string; count: number }>;
  };
  nonRetryable: {
    count: number;
    reasons: Array<{ reason: string; count: number }>;
  };
  requiresAction: {
    count: number;
    reasons: Array<{ reason: string; count: number }>;
  };
}

// Legacy component - kept for backward compatibility but not exported as default
export function RetryPreviewModalWithProps({ isOpen, onClose, onConfirm, sessionId }: RetryPreviewModalProps) {
  const { addToast } = useUI();
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RetryPreviewData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadPreview();
    }
  }, [isOpen, sessionId]);

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const response = await messageApiClient.getRetryPreview(sessionId);
      if (response.success) {
        setPreviewData({
          retryable: response.retryable,
          nonRetryable: response.nonRetryable,
          requiresAction: response.requiresAction,
        });
      } else {
        addToast('فشل تحميل معاينة إعادة المحاولة', 'error');
        onClose();
      }
    } catch (error) {
      addToast('حدث خطأ أثناء تحميل المعاينة', 'error');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getTotalMessages = () => {
    if (!previewData) return 0;
    return previewData.retryable.count + previewData.nonRetryable.count + previewData.requiresAction.count;
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="معاينة إعادة المحاولة"
      size="lg"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <i className="fas fa-spinner fa-spin text-2xl text-blue-600"></i>
            <span className="mr-3 text-gray-600">جاري التحميل...</span>
          </div>
        ) : previewData ? (
          <>
            {/* Summary Section */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                إعادة محاولة {getTotalMessages()} رسالة فاشلة؟
              </h3>
              
              {/* Retryable Messages */}
              {previewData.retryable.count > 0 && (
                <div className="bg-white rounded-lg p-3 mb-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-check-circle text-green-600"></i>
                    <span className="font-semibold text-green-800">
                      سيتم إعادة المحاولة ({previewData.retryable.count} رسالة)
                    </span>
                  </div>
                  {!showDetails && previewData.retryable.reasons.length > 0 && (
                    <ul className="text-sm text-gray-700 mr-6 space-y-1">
                      {previewData.retryable.reasons.slice(0, 3).map((r, idx) => (
                        <li key={idx}>
                          • {r.reason}: {r.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Non-Retryable Messages */}
              {previewData.nonRetryable.count > 0 && (
                <div className="bg-white rounded-lg p-3 mb-3 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-times-circle text-red-600"></i>
                    <span className="font-semibold text-red-800">
                      لا يمكن إعادة المحاولة ({previewData.nonRetryable.count} رسالة)
                    </span>
                  </div>
                  {!showDetails && previewData.nonRetryable.reasons.length > 0 && (
                    <ul className="text-sm text-gray-700 mr-6 space-y-1">
                      {previewData.nonRetryable.reasons.slice(0, 3).map((r, idx) => (
                        <li key={idx}>
                          • {r.reason}: {r.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Requires Action Messages */}
              {previewData.requiresAction.count > 0 && (
                <div className="bg-white rounded-lg p-3 border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-exclamation-triangle text-yellow-600"></i>
                    <span className="font-semibold text-yellow-800">
                      يتطلب إجراء ({previewData.requiresAction.count} رسالة)
                    </span>
                  </div>
                  {!showDetails && previewData.requiresAction.reasons.length > 0 && (
                    <ul className="text-sm text-gray-700 mr-6 space-y-1">
                      {previewData.requiresAction.reasons.slice(0, 3).map((r, idx) => (
                        <li key={idx}>
                          • {r.reason}: {r.count}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Details Section (Expandable) */}
            {showDetails && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {/* Retryable Details */}
                {previewData.retryable.count > 0 && (
                  <div>
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-check-circle"></i>
                      رسائل قابلة لإعادة المحاولة
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 mr-6">
                      {previewData.retryable.reasons.map((r, idx) => (
                        <li key={idx}>
                          • {r.reason}: <span className="font-medium">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Non-Retryable Details */}
                {previewData.nonRetryable.count > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-times-circle"></i>
                      رسائل غير قابلة لإعادة المحاولة
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 mr-6">
                      {previewData.nonRetryable.reasons.map((r, idx) => (
                        <li key={idx}>
                          • {r.reason}: <span className="font-medium">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Requires Action Details */}
                {previewData.requiresAction.count > 0 && (
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle"></i>
                      رسائل تتطلب إجراء
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1 mr-6">
                      {previewData.requiresAction.reasons.map((r, idx) => (
                        <li key={idx}>
                          • {r.reason}: <span className="font-medium">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* View Details Toggle */}
            {(previewData.retryable.reasons.length > 3 || 
              previewData.nonRetryable.reasons.length > 3 || 
              previewData.requiresAction.reasons.length > 3) && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <i className={`fas fa-chevron-${showDetails ? 'up' : 'down'}`}></i>
                {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
              </button>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={handleConfirm}
                disabled={previewData.retryable.count === 0}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                title={previewData.retryable.count === 0 ? 'لا توجد رسائل قابلة لإعادة المحاولة' : ''}
              >
                <i className="fas fa-redo"></i>
                إعادة المحاولة ({previewData.retryable.count})
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            لا توجد بيانات متاحة
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function RetryPreviewModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();

  const isOpen = openModals.has('retryPreview');
  const modalData = getModalData('retryPreview');
  
  // Extract failed tasks from modal context
  const failedTasks = modalData?.failedTasks || [];
  const retryCount = failedTasks.length;

  const handleConfirmRetry = async () => {
    if (retryCount === 0) {
      addToast('لا توجد مهام محددة لإعادة المحاولة', 'warning');
      return;
    }

    try {
      // TODO: Call API to retry failed tasks
      // await messageApiClient.retryMessages(failedTasks.map(t => t.id));
      addToast(`تم إعادة محاولة ${retryCount} مهمة بنجاح`, 'success');
      closeModal('retryPreview');
    } catch (error) {
      addToast('حدث خطأ أثناء إعادة المحاولة', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('retryPreview')}
      title="معاينة إعادة المحاولة"
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-yellow-800">المهام الفاشلة المحددة لإعادة المحاولة</h4>
              <p className="text-sm text-yellow-600">{retryCount} مهمة محددة</p>
            </div>
            <i className="fas fa-redo text-2xl text-yellow-600"></i>
          </div>
        </div>

        {failedTasks.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 flex items-center justify-center min-h-96">
            <div className="text-center">
              <i className="fas fa-inbox text-4xl text-gray-400 mb-2"></i>
              <p className="text-gray-600">لا توجد مهام محددة لإعادة المحاولة</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
            <div className="px-4 py-3 bg-gray-50 border-b flex-shrink-0">
              <h4 className="font-bold text-gray-800">جدول المعاينة</h4>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الاسم</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الهاتف</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">سبب الفشل</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الحالة المتوقعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {failedTasks.map((task: any) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{task.patientName || 'غير محدد'}</td>
                      <td className="px-4 py-2">{task.phoneNumber || '-'}</td>
                      <td className="px-4 py-2 text-red-600">{task.failureReason || 'خطأ غير معروف'}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          متوقع النجاح
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleConfirmRetry}
            className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-redo"></i>
            تأكيد إعادة المحاولة
          </button>
          <button
            onClick={() => closeModal('retryPreview')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
