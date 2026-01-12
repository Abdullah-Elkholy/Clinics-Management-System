'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useWhatsAppSession, DetailedSessionStatus, ExtensionStatus } from '../../contexts/WhatsAppSessionContext';
import { getRoleDisplayName } from '../../lib/auth';
import { User } from '../../types';

// Helper function to get detailed status display based on DetailedSessionStatus
const getDetailedStatusDisplay = (
  detailedStatus: DetailedSessionStatus,
  extensionStatus: ExtensionStatus | null,
  sessionStatus: 'connected' | 'disconnected' | 'pending' | null,
  globalPauseState: { isPaused: boolean; pauseReason?: string } | null
) => {
  // Use detailed status if available
  switch (detailedStatus) {
    case 'connected_sending':
      return {
        bgColor: 'bg-green-100',
        dotColor: 'bg-green-500 animate-pulse',
        textColor: 'text-green-700',
        label: 'جاري إرسال الرسائل',
        icon: 'paper-plane',
        sublabel: 'يتم إرسال الرسائل حالياً...',
      };
    case 'connected_idle':
      return {
        bgColor: 'bg-green-100',
        dotColor: 'bg-green-500',
        textColor: 'text-green-700',
        label: 'واتساب متصل وجاهز',
        icon: 'check-circle',
        sublabel: 'جاهز لإرسال الرسائل',
      };
    case 'connected_paused':
      return {
        bgColor: 'bg-yellow-100',
        dotColor: 'bg-yellow-500',
        textColor: 'text-yellow-700',
        label: 'الإرسال متوقف مؤقتاً',
        icon: 'pause-circle',
        sublabel: 'اضغط استئناف لمتابعة الإرسال',
      };
    case 'extension_connected':
      return {
        bgColor: 'bg-blue-100',
        dotColor: 'bg-blue-500 animate-pulse',
        textColor: 'text-blue-700',
        label: 'الإضافة متصلة',
        icon: 'puzzle-piece',
        sublabel: 'اضغط "فتح واتساب" في نافذة الإضافة',
      };
    case 'extension_disconnected':
      return {
        bgColor: 'bg-orange-100',
        dotColor: 'bg-orange-500',
        textColor: 'text-orange-700',
        label: 'الإضافة غير متصلة',
        icon: 'exclamation-triangle',
        sublabel: 'افتح المتصفح ثم اضغط على أيقونة الإضافة',
      };
    case 'no_extension':
      return {
        bgColor: 'bg-gray-100',
        dotColor: 'bg-gray-400',
        textColor: 'text-gray-600',
        label: 'الإضافة غير نشطة',
        icon: 'plug',
        sublabel: 'افتح الإضافة واضغط "بدء الجلسة"',
      };
    case 'pending_qr':
      return {
        bgColor: 'bg-yellow-100',
        dotColor: 'bg-yellow-500 animate-pulse',
        textColor: 'text-yellow-700',
        label: 'في انتظار مسح QR',
        icon: 'qrcode',
        sublabel: 'افتح واتساب على هاتفك وامسح الكود',
      };
    case 'pending_net':
      return {
        bgColor: 'bg-orange-100',
        dotColor: 'bg-orange-500',
        textColor: 'text-orange-700',
        label: 'مشكلة في الاتصال',
        icon: 'wifi',
        sublabel: 'تحقق من الإنترنت واتصال الهاتف',
      };
    case 'browser_closed':
      return {
        bgColor: 'bg-red-100',
        dotColor: 'bg-red-500',
        textColor: 'text-red-700',
        label: 'المتصفح مغلق',
        icon: 'times-circle',
        sublabel: 'أعد فتح المتصفح وشغّل الإضافة',
      };
    case 'loading':
      return {
        bgColor: 'bg-gray-100',
        dotColor: 'bg-gray-400 animate-pulse',
        textColor: 'text-gray-600',
        label: 'جاري التحميل...',
        icon: 'spinner',
        sublabel: undefined,
      };
    case 'disconnected':
    default:
      return {
        bgColor: 'bg-gray-100',
        dotColor: 'bg-gray-400',
        textColor: 'text-gray-600',
        label: 'غير متصل',
        icon: 'plug',
        sublabel: 'افتح الإضافة واضغط "بدء الجلسة"',
      };
  }
};

export default function Header() {
  const { user, logout } = useAuth();
  const { setCurrentPanel, currentPanel } = useUI();
  const { sessionStatus, detailedStatus, extensionStatus, globalPauseState } = useWhatsAppSession();

  if (!user) return null;

  // Get status display based on detailed status
  const statusDisplay = getDetailedStatusDisplay(detailedStatus, extensionStatus, sessionStatus, globalPauseState);

  // Navigate to WhatsApp Auth tab in management panel
  const handleWhatsAppStatusClick = () => {
    // Persist desired tab (used when management panel mounts)
    sessionStorage.setItem('userManagementActiveTab', 'whatsappAuth');

    const dispatchTabSwitch = () => {
      // Used when management panel is already mounted (same-panel navigation)
      window.dispatchEvent(
        new CustomEvent('userManagementActiveTabChange', { detail: 'whatsappAuth' })
      );
    };

    if (currentPanel === 'management') {
      // Already on management panel: force-switch tab immediately
      dispatchTabSwitch();
      return;
    }

    // Navigate to management panel, then request tab switch (next tick)
    setCurrentPanel('management');
    setTimeout(dispatchTabSwitch, 0);
  };

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
            <p className="text-sm text-gray-600">{roleDisplay}/ {fullName}</p>
          </div>
        </div>

        {/* Right side - Status and User Menu */}
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* WhatsApp Status - Hidden for admin, shown for moderator and user */}
          {user.role !== 'primary_admin' && user.role !== 'secondary_admin' && (
            <div 
              className="hidden sm:flex items-center gap-2 cursor-pointer group"
              onClick={handleWhatsAppStatusClick}
              title="اضغط لفتح إعدادات ربط واتساب"
            >
              {/* Status pill */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full group-hover:ring-2 group-hover:ring-blue-300 transition-all ${statusDisplay.bgColor}`}>
                {/* Status icon */}
                <i className={`fas fa-${statusDisplay.icon} ${statusDisplay.textColor} text-sm ${statusDisplay.icon === 'spinner' ? 'animate-spin' : ''}`}></i>
                
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full ${statusDisplay.dotColor}`}></div>
                
                {/* Status text */}
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${statusDisplay.textColor}`}>
                    {statusDisplay.label}
                  </span>
                  {statusDisplay.sublabel && (
                    <span className={`text-xs ${statusDisplay.textColor} opacity-75`}>
                      {statusDisplay.sublabel}
                    </span>
                  )}
                </div>
              </div>
              {/* Settings icon hint */}
              <i className="fas fa-cog text-gray-400 group-hover:text-blue-500 group-hover:rotate-90 transition-all text-sm"></i>
            </div>
          )}

          {/* Logout */}
          <div className="flex items-center pl-4 border-l border-gray-200">
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
