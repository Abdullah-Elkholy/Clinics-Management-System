'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { useWhatsAppSession } from '../../contexts/WhatsAppSessionContext';
import { getRoleDisplayName } from '../../lib/auth';
import { User } from '../../types';

export default function Header() {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const { sessionStatus } = useWhatsAppSession();

  if (!user) return null;

  // Helper function to get user display name following priority:
  // 1. firstName + lastName (if both exist)
  // 2. firstName (if lastName is null/empty)
  // 3. المشرف #${id} (ID-based fallback)
  // 4. username (last fallback)
  const getUserDisplayName = (u: User): string => {
    if (u.firstName && u.lastName) {
      return `${u.firstName} ${u.lastName}`;
    }
    if (u.firstName) {
      return u.firstName;
    }
    if (u.id) {
      return `المشرف #${u.id}`;
    }
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
            <div className={`hidden sm:flex items-center space-x-2 space-x-reverse px-3 py-1 rounded-full ${
              sessionStatus === 'connected' 
                ? 'bg-green-100' 
                : sessionStatus === 'pending' 
                ? 'bg-yellow-100' 
                : 'bg-red-100'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                sessionStatus === 'connected' 
                  ? 'bg-green-500 animate-pulse' 
                  : sessionStatus === 'pending' 
                  ? 'bg-yellow-500 animate-pulse' 
                  : 'bg-red-500'
              }`}></div>
              <span className={`text-sm ${
                sessionStatus === 'connected' 
                  ? 'text-green-700' 
                  : sessionStatus === 'pending' 
                  ? 'text-yellow-700' 
                  : 'text-red-700'
              }`}>
                {sessionStatus === 'connected' 
                  ? 'واتساب متصل' 
                  : sessionStatus === 'pending' 
                  ? 'في انتظار المصادقة' 
                  : 'واتساب غير متصل'}
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
