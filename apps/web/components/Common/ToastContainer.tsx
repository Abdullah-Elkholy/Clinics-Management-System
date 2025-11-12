'use client';

import { useUI } from '../../contexts/UIContext';
import { useState } from 'react';

export default function ToastContainer() {
  const { toasts, removeToast } = useUI();
  const [expandedToastId, setExpandedToastId] = useState<string | null>(null);
  const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_ERRORS === 'true';

  const getToastColors = (type: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      success: {
        bg: 'bg-green-100',
        border: 'border-green-400',
        text: 'text-green-800',
        icon: 'fa-check-circle',
      },
      error: {
        bg: 'bg-red-100',
        border: 'border-red-400',
        text: 'text-red-800',
        icon: 'fa-exclamation-circle',
      },
      info: {
        bg: 'bg-blue-100',
        border: 'border-blue-400',
        text: 'text-blue-800',
        icon: 'fa-info-circle',
      },
      warning: {
        bg: 'bg-yellow-100',
        border: 'border-yellow-400',
        text: 'text-yellow-800',
        icon: 'fa-warning',
      },
    };
    return colors[type] || colors.info;
  };

  const handleDebugClick = (toast: any) => {
    const isExpanded = expandedToastId === toast.id;
    setExpandedToastId(isExpanded ? null : toast.id);
    if (isDebugEnabled && toast.debugData && process.env.NODE_ENV === 'development') {
      // Debug log only in development to keep production console clean
      // console.log('🐛 Debug Info for Toast:', toast.debugData);
    }
  };

  return (
    <div id="toastContainer" className="fixed top-4 left-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const colors = getToastColors(toast.type);
        const isExpanded = expandedToastId === toast.id;
        const hasDebugData = isDebugEnabled && toast.debugData && Object.keys(toast.debugData).length > 0;

        return (
          <div key={toast.id} className="flex flex-col">
            <div
              className={`toast ${colors.bg} border-2 ${colors.border} ${colors.text} px-5 py-4 rounded-lg shadow-xl flex items-center justify-between gap-3 animate-slideIn font-medium transition-all ${
                isExpanded ? 'rounded-b-none' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <i className={`fas ${colors.icon} flex-shrink-0`}></i>
                <span className="text-sm font-medium break-words">{toast.message}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasDebugData && (
                  <button
                    onClick={() => handleDebugClick(toast)}
                    title="عرض التفاصيل التقنية"
                    className="hover:opacity-70 transition-opacity text-xs px-2 py-1 bg-opacity-20 rounded"
                  >
                    <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                  </button>
                )}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="hover:opacity-70 transition-opacity flex-shrink-0"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            {isExpanded && hasDebugData && (
              <div
                className={`${colors.bg} border-2 ${colors.border} border-t-0 ${colors.text} px-5 py-3 rounded-b-lg shadow-xl text-xs max-h-48 overflow-y-auto`}
              >
                <pre className="font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(toast.debugData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
