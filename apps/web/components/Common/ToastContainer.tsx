'use client';

import { useUI } from '../../contexts/UIContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useUI();

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

  return (
    <div id="toastContainer" className="fixed top-4 left-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => {
        const colors = getToastColors(toast.type);
        return (
          <div
            key={toast.id}
            className={`toast ${colors.bg} border-2 ${colors.border} ${colors.text} px-5 py-4 rounded-lg shadow-xl flex items-center justify-between gap-3 animate-slideIn max-w-xs font-medium`}
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
