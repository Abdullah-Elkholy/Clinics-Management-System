'use client';

import React from 'react';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'number' | 'email' | 'password';
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function InputDialog({
  isOpen,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  inputType = 'text',
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = React.useState(defaultValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Auto-focus and select text after render
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(value);
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
              <i className={`fas fa-pen-to-square ${iconColor} text-2xl`}></i>
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

            {/* Input Field with Enhanced Styling */}
            <div className="relative">
              <label htmlFor="inputDialog-input" className="sr-only">{placeholder || 'إدخال نص'}</label>
              <input
                id="inputDialog-input"
                name="input"
                ref={inputRef}
                type={inputType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                dir="rtl"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:border-blue-500 text-right rtl:text-right bg-white transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed hover:border-gray-400"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => setValue('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="مسح"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
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
              disabled={isLoading || !value}
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
