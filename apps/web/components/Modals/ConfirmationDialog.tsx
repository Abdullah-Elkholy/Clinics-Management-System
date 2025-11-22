'use client';

import { useEffect, useRef } from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  cancelButtonClass?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  confirmButtonClass = 'bg-blue-600 hover:bg-blue-700',
  cancelButtonClass = 'bg-gray-300 hover:bg-gray-400',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key cancels
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
      // Enter key confirms (only if not loading)
      else if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onConfirm, onCancel]);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Small delay to ensure dialog is rendered
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Use red colors if it's a dangerous action
  const buttonClass = isDangerous ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : confirmButtonClass;
  const headerBg = isDangerous ? 'bg-gradient-to-r from-red-50 to-red-100 border-b-2 border-red-200' : 'bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200';
  const iconColor = isDangerous ? 'text-red-600' : 'text-blue-600';

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not children
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  const handleDialogClick = (e: React.MouseEvent) => {
    // Prevent clicks inside dialog from bubbling to backdrop
    e.stopPropagation();
  };

  const handleConfirmClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      onConfirm();
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      onCancel();
    }
  };

  return (
    <>
      {/* Animated Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998] animate-fadeIn"
        onClick={handleBackdropClick}
        role="presentation"
        aria-hidden="true"
      ></div>

      {/* Dialog Container with Animation */}
      <div 
        className="fixed inset-0 flex items-center justify-center z-[9999] p-4 animate-slideUp pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-message"
      >
        <div 
          ref={dialogRef}
          className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all pointer-events-auto"
          onClick={handleDialogClick}
        >
          {/* Header with Gradient */}
          <div className={`px-6 py-5 ${headerBg}`} dir="rtl">
            <h3 id="confirmation-dialog-title" className="text-lg font-bold text-gray-900 flex items-center justify-self-auto gap-3 text-right">
              <i className={`fas ${isDangerous ? 'fa-exclamation-circle' : 'fa-check-circle'} ${iconColor} text-2xl`}></i>
              <span>{title}</span>
            </h3>
          </div>

          {/* Content */}
          <div className="px-6 py-5 bg-white">
            <p id="confirmation-dialog-message" className="text-gray-700 text-sm leading-relaxed text-right">{message}</p>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex gap-3 justify-end space-x-reverse">
            <button
              type="button"
              ref={confirmButtonRef}
              onClick={handleConfirmClick}
              disabled={isLoading}
              className={`px-5 py-2.5 rounded-xl text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2 active:scale-95 ${buttonClass}`}
            >
              {isLoading && <i className="fas fa-spinner fa-spin"></i>}
              {confirmText}
            </button>
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-gray-700 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 active:scale-95"
            >
              {cancelText}
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
