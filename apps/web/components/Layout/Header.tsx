'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { useWhatsAppSession } from '../../contexts/WhatsAppSessionContext';
import { getRoleDisplayName } from '../../lib/auth';
import { User } from '../../types';

// Helper function to get status display based on WhatsAppSession.Status and globalPauseState
// PRIORITY: WhatsAppSession.Status takes precedence - if connected, show connected
const getWhatsAppStatusDisplay = (
  sessionStatus: 'connected' | 'disconnected' | 'pending' | null,
  globalPauseState: { isPaused: boolean; pauseReason?: string } | null
) => {
  // PRIORITY 1: If WhatsAppSession.Status is 'connected', always show connected
  // (even if paused - pause is for task control, not connection status)
  if (sessionStatus === 'connected') {
    // Show connected with pause indicator if paused
    if (globalPauseState?.isPaused) {
      return {
        bgColor: 'bg-green-100',
        dotColor: 'bg-green-500', // No animation when paused
        textColor: 'text-green-700',
        label: 'واتساب متصل (متوقف مؤقتاً)'
      };
    }
    return {
      bgColor: 'bg-green-100',
      dotColor: 'bg-green-500 animate-pulse',
      textColor: 'text-green-700',
      label: 'واتساب متصل'
    };
  }

  // PRIORITY 2: Check global pause state for specific error reasons (only when NOT connected)
  if (globalPauseState?.isPaused && globalPauseState.pauseReason) {
    if (globalPauseState.pauseReason.includes('PendingQR')) {
      return {
        bgColor: 'bg-yellow-100',
        dotColor: 'bg-yellow-500 animate-pulse',
        textColor: 'text-yellow-700',
        label: 'في انتظار المصادقة (PendingQR)'
      };
    }
    if (globalPauseState.pauseReason.includes('PendingNET')) {
      return {
        bgColor: 'bg-orange-100',
        dotColor: 'bg-orange-500',
        textColor: 'text-orange-700',
        label: 'فشل الاتصال بالإنترنت (PendingNET)'
      };
    }
    if (globalPauseState.pauseReason.includes('BrowserClosure')) {
      return {
        bgColor: 'bg-red-100',
        dotColor: 'bg-red-500',
        textColor: 'text-red-700',
        label: 'تم إغلاق المتصفح'
      };
    }
  }

  // PRIORITY 3: Fallback to WhatsAppSession.Status
  switch (sessionStatus) {
    case 'pending':
      return {
        bgColor: 'bg-yellow-100',
        dotColor: 'bg-yellow-500 animate-pulse',
        textColor: 'text-yellow-700',
        label: 'في انتظار المصادقة'
      };
    case 'disconnected':
    default:
      return {
        bgColor: 'bg-red-100',
        dotColor: 'bg-red-500',
        textColor: 'text-red-700',
        label: 'واتساب غير متصل'
      };
  }
};

export default function Header() {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const { sessionStatus, globalPauseState } = useWhatsAppSession();

  if (!user) return null;

  // Get status display based on WhatsAppSession.Status
  const statusDisplay = getWhatsAppStatusDisplay(sessionStatus, globalPauseState);

  // Helper function to get user display name following priority:
  // 1. firstName + lastName (if both exist)
  // 2. firstName (if lastName is null/empty)
  // 3. username (fallback)
  const getUserDisplayName = (u: User): string => {
    if (u.firstName && u.lastName) {
      return `${u.firstName} ${u.lastName}`;
    }
    if (u.firstName) {
      return u.firstName;
    }
    // Use username instead of ID as fallback
    return u.username || 'Unknown';
  };

  const roleDisplay = getRoleDisplayName(user.role);
  const fullName = getUserDisplayName(user);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-2 h-20 md:h-24">
        {/* Left side - Logo and Title */}
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">
            <i className="fas fa-clinic-medical text-blue-600"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">نظام إدارة العيادات</h1>
            <p className="text-sm text-gray-600">{roleDisplay}</p>
          </div>
        </div>

        {/* Right side - Status and User Menu */}
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* WhatsApp Status - Hidden for admin, shown for moderator and user */}
          {user.role !== 'primary_admin' && user.role !== 'secondary_admin' && (
            <div className={`hidden sm:flex items-center space-x-2 space-x-reverse px-3 py-1 rounded-full ${statusDisplay.bgColor}`}>
              <div className={`w-2 h-2 rounded-full ${statusDisplay.dotColor}`}></div>
              <span className={`text-sm ${statusDisplay.textColor}`}>
                {statusDisplay.label}
              </span>
            </div>
          )}

          {/* User Info and Logout */}
          <div className="flex items-center space-x-3 space-x-reverse pl-4 border-l border-gray-200">
            <span className="text-sm text-gray-700 font-medium">{fullName}</span>
            <button
              onClick={() => openModal('accountInfo')}
              className="text-blue-600 hover:text-blue-700 transition-colors"
              title="معلومات الحساب"
            >
              <i className="fas fa-user-circle text-lg"></i>
            </button>
            <button
              onClick={logout}
              className="text-red-600 hover:text-red-700 transition-colors"
              title="تسجيل الخروج"
            >
              <i className="fas fa-sign-out-alt text-lg"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
