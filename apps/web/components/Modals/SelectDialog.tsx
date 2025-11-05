'use client';

import React from 'react';

interface SelectOption {
  id: string;
  label: string;
}

interface SelectDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  options: SelectOption[];
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function SelectDialog({
  isOpen,
  title,
  message,
  options,
  defaultValue = '',
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: SelectDialogProps) {
  const [selectedValue, setSelectedValue] = React.useState(defaultValue);
  const selectRef = React.useRef<HTMLSelectElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedValue(defaultValue);
      // Auto-focus after render
      setTimeout(() => {
        selectRef.current?.focus();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const buttonClass = isDangerous ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  const headerBg = isDangerous ? 'bg-gradient-to-r from-red-50 to-red-100 border-b-2 border-red-200' : 'bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200';
  const iconColor = isDangerous ? 'text-red-600' : 'text-blue-600';
  const icon = isDangerous ? 'fa-exclamation-circle' : 'fa-list';

  return (
    <>
      {/* Animated Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998] animate-fadeIn"
        onClick={onCancel}
      ></div>

      {/* Dialog Container with Animation */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 animate-slideUp pointer-events-none">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all pointer-events-auto">
          {/* Header with Gradient */}
          <div className={`px-6 py-5 ${headerBg}`} dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 flex items-center justify-end gap-3">
              <i className={`fas ${icon} ${iconColor} text-2xl`}></i>
              <span>{title}</span>
            </h2>
          </div>

          {/* Content */}
          <div className="px-6 py-5 bg-white space-y-4">
            <div className="text-right text-sm text-gray-700 leading-relaxed">
              {typeof message === 'string' ? (
                message.split('\n').map((line, idx) => (
                  <p key={idx} className="mb-2">{line || '\u00A0'}</p>
                ))
              ) : (
                message
              )}
            </div>

            {/* Select Field with Enhanced Styling */}
            <div className="relative">
              <select
                ref={selectRef}
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                dir="rtl"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:border-red-500 text-right rtl:text-right bg-white transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed hover:border-gray-400 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'left 12px center',
                  backgroundSize: '1.5em 1.5em',
                  paddingLeft: '2.5rem',
                }}
              >
                <option value="">اختر قالباً...</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex gap-3 justify-end space-x-reverse">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-gray-700 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 active:scale-95"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || !selectedValue}
              className={`px-5 py-2.5 rounded-xl text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 active:scale-95 ${buttonClass}`}
            >
              {isLoading && <i className="fas fa-spinner fa-spin"></i>}
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }

        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </>
  );
}
