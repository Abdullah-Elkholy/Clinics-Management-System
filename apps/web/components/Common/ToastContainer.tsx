'use client';

import { useUI } from '../../contexts/UIContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useUI();

  const getToastColors = (type: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
      success: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        icon: 'fa-check-circle',
      },
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        icon: 'fa-exclamation-circle',
      },
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        icon: 'fa-info-circle',
      },
      warning: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-700',
        icon: 'fa-warning',
      },
    };
    return colors[type] || colors.info;
  };

  return (
    <div id="toastContainer" className="fixed top-4 left-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const colors = getToastColors(toast.type);
        return (
          <div
            key={toast.id}
            className={`toast ${colors.bg} border ${colors.border} ${colors.text} px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 animate-slideIn max-w-xs`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <i className={`fas ${colors.icon} flex-shrink-0`}></i>
              <span className="text-sm font-medium break-words">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="hover:opacity-70 transition-opacity flex-shrink-0 ml-2"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
}
