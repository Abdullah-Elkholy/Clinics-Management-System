'use client';

import React, { useCallback } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmButtonVariant?: 'danger' | 'warning' | 'success' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string; // FontAwesome icon class
  isDangerous?: boolean; // For destructive actions
}

/**
 * General Confirmation Modal Component
 * Reusable for all confirmation dialogs across the application
 * Supports different button styles and custom messages
 */
export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  confirmButtonVariant = 'primary',
  onConfirm,
  onCancel,
  icon = 'fa-question-circle',
  isDangerous = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  // Determine button color based on variant
  const getButtonColor = () => {
    switch (confirmButtonVariant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full ${
                    isDangerous ? 'bg-red-100' : 'bg-blue-100'
                  }`}
                >
                  <i
                    className={`fas ${icon} ${isDangerous ? 'text-red-600' : 'text-blue-600'}`}
                  ></i>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <div className="text-gray-700 text-sm space-y-2">
              {typeof message === 'string' ? (
                <p>{message}</p>
              ) : (
                message
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${getButtonColor()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
