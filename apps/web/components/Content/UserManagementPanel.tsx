'use client';

import React, { useState, useEffect } from 'react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useModeratorQuota } from '@/hooks/useModeratorQuota';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { UserRole } from '@/types/roles';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/services/userManagementService';
import { ModeratorQuota } from '@/types/user';
import { useRoleBasedUI } from '@/hooks/useRoleBasedUI';
import EditUserModal from '@/components/Modals/EditUserModal';
import EditAccountModal from '@/components/Modals/EditAccountModal';
import AddUserModal from '@/components/Modals/AddUserModal';
import ModeratorQuotaDisplay from '@/components/Moderators/ModeratorQuotaDisplay';
import ModeratorQuotaModal from '@/components/Moderators/ModeratorQuotaModal';
import ModeratorMessagesQuotaModal from '@/components/Moderators/ModeratorMessagesQuotaModal';
import ModeratorQueuesQuotaModal from '@/components/Moderators/ModeratorQueuesQuotaModal';
import moderatorQuotaService from '@/services/moderatorQuotaService';

/**
 * UserManagementPanel - Manage moderators and their users
 * Features:
 * - Display moderators with expandable user lists
 * - Show users managed by each moderator
 * - Create, Edit, Delete users
 * - Collapsible sections per moderator
 */
export default function UserManagementPanel() {
  const { user: currentUser } = useAuth();
  const { permissions, roleInfo } = useRoleBasedUI();
  const [state, actions] = useUserManagement();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'moderators' | 'myUsers' | 'secondaryAdmins' | 'whatsappAuth' | 'quota' | 'accountSettings' | 'logs'>('moderators');
  const [expandedModerators, setExpandedModerators] = useState<Set<string>>(new Set());
  const [expandedSecondaryAdmins, setExpandedSecondaryAdmins] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [logsPerPage, setLogsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedModerator, setSelectedModerator] = useState<string | null>(null);
  
  // Sync when selectedRole changes (no console logging)
  useEffect(() => {
    // placeholder effect for any side-effects if needed later
  }, [selectedRole]);

  // Set default tab based on user role
  useEffect(() => {
    if (currentUser) {
      switch (currentUser.role) {
        case UserRole.PrimaryAdmin:
          setActiveTab('moderators');
          break;
        case UserRole.SecondaryAdmin:
          setActiveTab('moderators');
          break;
        case UserRole.Moderator:
          setActiveTab('myUsers');
          break;
        case UserRole.User:
          setActiveTab('accountSettings');
          break;
        default:
          setActiveTab('accountSettings');
      }
    }
  }, [currentUser]);
  
  // Quota management state
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showMessagesQuotaModal, setShowMessagesQuotaModal] = useState(false);
  const [showQueuesQuotaModal, setShowQueuesQuotaModal] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<ModeratorQuota | null>(null);
  const [selectedModeratorForQuota, setSelectedModeratorForQuota] = useState<User | null>(null);
  const [quotaSaving, setQuotaSaving] = useState(false);

  // Export logs to CSV
  const handleExportLogs = async () => {
    setIsExporting(true);
    try {
      // TODO: Fetch actual logs from backend API
      // For now, export current user's settings as placeholder
      const logData = [
        { timestamp: new Date().toISOString(), level: 'Information', message: 'User settings exported', source: 'UserManagementPanel.tsx', userId: currentUser?.id, userName: currentUser?.firstName }
      ];

      // Prepare CSV content
      const headers = ['الوقت', 'المستوى', 'الرسالة', 'المصدر', 'معرف المستخدم', 'اسم المستخدم'];
      const csvContent = [
        headers.join(','),
        ...logData.map(log =>
          [log.timestamp, log.level, `"${log.message}"`, log.source, log.userId || 'N/A', log.userName || 'N/A'].join(',')
        ),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `logs-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast('تم تصدير السجلات بنجاح', 'success');
    } catch (error) {
      addToast('فشل تصدير السجلات', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch users on mount
  useEffect(() => {
    actions.fetchUsers();
  }, []);

  // Get all moderators
  const getModerators = (): User[] => {
    return state.users.filter((u) => u.role === UserRole.Moderator);
  };

  // Get all secondary admins
  const getSecondaryAdmins = (): User[] => {
    return state.users.filter((u) => u.role === UserRole.SecondaryAdmin);
  };

  // Get users managed by a specific moderator
  const getUsersByModerator = (moderatorId: string): User[] => {
    return state.users.filter(
      (u) => u.role === UserRole.User && u.assignedModerator === moderatorId
    );
  };

  // Get role badge color and label
  const getRoleInfo = (role: UserRole | string) => {
    // Normalize role value for comparison
    const normalizedRole = String(role).toLowerCase().trim();
    
    switch (normalizedRole) {
      case 'primary_admin':
      case UserRole.PrimaryAdmin:
        return { label: 'المدير الأساسي', color: 'bg-red-100 text-red-800' };
      case 'secondary_admin':
      case UserRole.SecondaryAdmin:
        return { label: 'مدير ثانوي', color: 'bg-orange-100 text-orange-800' };
      case 'moderator':
      case UserRole.Moderator:
        return { label: 'مشرف', color: 'bg-green-100 text-green-800' };
      case 'user':
      case UserRole.User:
        return { label: 'مستخدم', color: 'bg-blue-100 text-blue-800' };
      default:
        return { label: 'غير معروف', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const toggleModerator = (moderatorId: string) => {
    const newExpanded = new Set(expandedModerators);
    if (newExpanded.has(moderatorId)) {
      newExpanded.delete(moderatorId);
    } else {
      newExpanded.add(moderatorId);
    }
    setExpandedModerators(newExpanded);
  };

  const toggleSecondaryAdmin = (adminId: string) => {
    const newExpanded = new Set(expandedSecondaryAdmins);
    if (newExpanded.has(adminId)) {
      newExpanded.delete(adminId);
    } else {
      newExpanded.add(adminId);
    }
    setExpandedSecondaryAdmins(newExpanded);
  };

  const handleAddUser = (role: UserRole, moderatorId?: string) => {
    setSelectedUser(null);
    setSelectedRole(role);
    setSelectedModerator(moderatorId || null);
    // Pass role through modal context data instead of just relying on component props
    openModal('addUser', { role });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    openModal('editUser');
  };

  const handleDeleteUser = async (user: User) => {
    const fullName = user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
    const confirmed = await confirm(createDeleteConfirmation(fullName));
    if (!confirmed) return;

    const success = await actions.deleteUser(user.id);
    if (success) {
      addToast(`تم حذف المستخدم ${fullName} بنجاح`, 'success');
      setSelectedUser(null);
    }
  };

  const handleEditModerator = (moderator: User) => {
    setSelectedUser(moderator);
    openModal('editUser');
  };

  const handleDeleteModerator = async (moderator: User) => {
    const fullName = moderator.lastName ? `${moderator.firstName} ${moderator.lastName}` : moderator.firstName;
    const confirmed = await confirm(createDeleteConfirmation(fullName));
    if (!confirmed) return;

    const success = await actions.deleteUser(moderator.id);
    if (success) {
      addToast(`تم حذف المشرف ${fullName} بنجاح`, 'success');
      setSelectedUser(null);
    }
  };

  // Handle opening quota editor (kept for backward compatibility)
  const handleEditQuota = async (moderator: User, quota: ModeratorQuota) => {
    setSelectedModeratorForQuota(moderator);
    setSelectedQuota(quota);
    setShowQuotaModal(true);
  };

  // Handle opening messages quota editor
  const handleEditMessagesQuota = async (moderator: User, quota: ModeratorQuota) => {
    setSelectedModeratorForQuota(moderator);
    setSelectedQuota(quota);
    setShowMessagesQuotaModal(true);
  };

  // Handle opening queues quota editor
  const handleEditQueuesQuota = async (moderator: User, quota: ModeratorQuota) => {
    setSelectedModeratorForQuota(moderator);
    setSelectedQuota(quota);
    setShowQueuesQuotaModal(true);
  };

  // Handle saving quota
  const handleSaveQuota = async (updatedQuota: ModeratorQuota) => {
    if (!selectedModeratorForQuota) return;

    setQuotaSaving(true);
    try {
      const result = await moderatorQuotaService.updateQuota(
        selectedModeratorForQuota.id,
        updatedQuota
      );
      if (result.success) {
        const fullName = selectedModeratorForQuota.lastName ? `${selectedModeratorForQuota.firstName} ${selectedModeratorForQuota.lastName}` : selectedModeratorForQuota.firstName;
        addToast(`تم تحديث حصة ${fullName} بنجاح`, 'success');
        setShowQuotaModal(false);
        setSelectedModeratorForQuota(null);
        setSelectedQuota(null);
      } else {
        addToast('فشل تحديث الحصة', 'error');
      }
    } catch (error) {
      addToast('حدث خطأ أثناء تحديث الحصة', 'error');
    } finally {
      setQuotaSaving(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'لم يسجل دخول';
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Pagination calculations
  const totalLogs = 1247;
  const totalPages = Math.ceil(totalLogs / logsPerPage);

  // Generate page numbers with ellipsis
  const getPaginationPages = () => {
    const pages: (number | string)[] = [];
    const delta = 2; // Show 2 pages on each side of current page

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return pages;
  };

  const moderators = getModerators();
  const secondaryAdmins = getSecondaryAdmins();
  const regularUsers = state.users.filter((u) => u.role === UserRole.User);

  // Get current user's managed users (for moderators and users)
  const myManagedUsers = currentUser?.role === UserRole.Moderator
    ? getUsersByModerator(currentUser.id)
    : [];

  // Unified tab styles (padding/colors/hover)
  const TAB_BASE = 'px-4 py-3 font-medium transition-all border-b-2 inline-flex items-center gap-2';
  const TAB_INACTIVE = 'border-transparent text-gray-600 hover:text-gray-900';
  const TAB_ACTIVE = {
    green: 'border-green-600 text-green-600',
    orange: 'border-orange-600 text-orange-600',
    emerald: 'border-emerald-600 text-emerald-600',
    indigo: 'border-indigo-600 text-indigo-600',
    blue: 'border-blue-600 text-blue-600',
    purple: 'border-purple-600 text-purple-600',
  } as const;

  return (
    <>
      {/* Error Alert */}
      {state.error && (
        <div className="mx-6 mt-4 rounded-lg bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Navigation Tabs - Role Based */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {/* Moderators Tab - Show for Primary & Secondary Admin */}
          {currentUser && (currentUser.role === UserRole.PrimaryAdmin || currentUser.role === UserRole.SecondaryAdmin) && (
            <button
              onClick={() => setActiveTab('moderators')}
              className={`${TAB_BASE} ${
                activeTab === 'moderators' ? TAB_ACTIVE.green : TAB_INACTIVE
              }`}
            >
              <i className="fas fa-user-shield"></i>
              المشرفون ({moderators.length})
            </button>
          )}

          {/* My Users Tab - Show for Moderators only */}
          {currentUser && currentUser.role === UserRole.Moderator && (
            <button
              onClick={() => setActiveTab('myUsers')}
              className={`${TAB_BASE} ${
                activeTab === 'myUsers' ? TAB_ACTIVE.green : TAB_INACTIVE
              }`}
            >
              <i className="fas fa-users"></i>
              المستخدمون ({myManagedUsers.length})
            </button>
          )}

          {/* Secondary Admins Tab - Show for Primary Admin only */}
          {currentUser && currentUser.role === UserRole.PrimaryAdmin && (
            <button
              onClick={() => setActiveTab('secondaryAdmins')}
              className={`${TAB_BASE} ${
                activeTab === 'secondaryAdmins' ? TAB_ACTIVE.orange : TAB_INACTIVE
              }`}
            >
              <i className="fas fa-user-tie"></i>
              المديرون الثانويون ({secondaryAdmins.length})
            </button>
          )}

          {/* WhatsApp Auth Tab - Show for Moderators and Users */}
          {currentUser && (currentUser.role === UserRole.Moderator || currentUser.role === UserRole.User) && (
            <button
              onClick={() => setActiveTab('whatsappAuth')}
              className={`${TAB_BASE} ${
                activeTab === 'whatsappAuth' ? TAB_ACTIVE.emerald : TAB_INACTIVE
              }`}
            >
              <i className="fab fa-whatsapp"></i>
              مصادقة واتساب
            </button>
          )}

          {/* Quota Tab - Show for Moderators and Users */}
          {currentUser && (currentUser.role === UserRole.Moderator || currentUser.role === UserRole.User) && (
            <button
              onClick={() => setActiveTab('quota')}
              className={`${TAB_BASE} ${
                activeTab === 'quota' ? TAB_ACTIVE.indigo : TAB_INACTIVE
              }`}
            >
              <i className="fas fa-chart-pie"></i>
              الحصة
            </button>
          )}

          {/* Account Settings Tab - Show for all */}
          <button
            onClick={() => setActiveTab('accountSettings')}
            className={`${TAB_BASE} ${
              activeTab === 'accountSettings' ? TAB_ACTIVE.blue : TAB_INACTIVE
            }`}
          >
            <i className="fas fa-user-cog"></i>
            معلومات الحساب
          </button>

          {/* Logs Tab - Show for Admins and Moderators */}
          {currentUser && currentUser.role !== UserRole.User && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`${TAB_BASE} ${
                activeTab === 'logs' ? TAB_ACTIVE.purple : TAB_INACTIVE
              }`}
            >
              <i className="fas fa-history"></i>
              السجلات
            </button>
          )}
        </div>

        {/* Loading State */}
        {state.loading && moderators.length === 0 && activeTab === 'moderators' && (
          <div className="flex justify-center py-12">
            <div className="animate-spin">
              <i className="fas fa-spinner text-2xl text-blue-600"></i>
            </div>
          </div>
        )}


        {/* Moderators Section */}
        {activeTab === 'moderators' && (
          <div className="space-y-6">
            {/* Moderators Info Header */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                <i className="fas fa-user-shield"></i>
                إدارة المشرفون وحصصهم ومستخدميهم
              </h3>
              <p className="text-sm text-green-700 mt-2">
                يمكنك هنا إضافة وتعديل وإدارة بيانات المشرفين وحصصهم في لرسائل والعيادات ومستخدميهم في النظام
              </p>
            </div>

            {/* Empty State */}
            {!state.loading && moderators.length === 0 && activeTab === 'moderators' && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                <i className="fas fa-users text-4xl text-gray-400 mb-4 block"></i>
                <p className="text-gray-600 mb-2">لا توجد مشرفون</p>
                <p className="text-sm text-gray-500">
                  لا يوجد مشرفون متاحون حالياً
                </p>
              </div>
            )}
            {/* Add Moderator Button */}
            {(currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin) && (
              <div>
                <button
                  onClick={() => handleAddUser(UserRole.Moderator)}
                  disabled={state.loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <i className="fas fa-plus"></i>
                  <span>إضافة مشرف جديد</span>
                </button>
              </div>
            )}

            {moderators.length > 0 && (
              <div className="space-y-4">
            {moderators.map((moderator) => {
              const managedUsers = getUsersByModerator(moderator.id);
              const isExpanded = expandedModerators.has(moderator.id);
              const roleInfo = getRoleInfo(moderator.role);

              return (
                <div
                  key={moderator.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Moderator Header */}
                  <div
                    onClick={() => toggleModerator(moderator.id)}
                    className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <i
                        className={`fas fa-chevron-down text-gray-600 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      ></i>
                      <span className="text-xs font-medium text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-200">
                        {managedUsers.length} مستخدم
                      </span>
                      <div className="text-right">
                        <h3 className="font-semibold text-gray-900">
                          {moderator.lastName ? `${moderator.firstName} ${moderator.lastName}` : moderator.firstName}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditModerator(moderator);
                        }}
                        title="تعديل المشرف"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteModerator(moderator);
                        }}
                        title="حذف المشرف"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* Managed Users Table */}
                  {isExpanded && (
                    <div className="bg-white border-t border-gray-200">
                      {/* Moderator Details Section */}
                      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 font-medium text-xs block mb-1">اسم المستخدم</span>
                            <p className="text-gray-900 font-semibold text-xs">@{moderator.username}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium text-xs block mb-1">تاريخ الإنشاء</span>
                            <p className="text-gray-900 font-semibold text-xs">
                              {moderator.createdAt ? new Date(moderator.createdAt).toLocaleString('en-US') : 'لم يحدد'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium text-xs block mb-1">آخر دخول</span>
                            <p className="text-gray-900 font-semibold text-xs">
                              {moderator.lastLogin ? new Date(moderator.lastLogin).toLocaleString('en-US') : 'لم يدخل بعد'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quota Display Section */}
                      <div className="px-6 py-4 border-b border-gray-200">
                        <ModeratorQuotaDisplay
                          moderatorId={moderator.id}
                          quota={moderator.role === 'moderator' && 'quota' in moderator ? (moderator as any).quota as ModeratorQuota : undefined}
                          onEditMessages={(quota) => handleEditMessagesQuota(moderator, quota)}
                          onEditQueues={(quota) => handleEditQueuesQuota(moderator, quota)}
                        />
                      </div>

                      {/* Add User Button for this Moderator */}
                      <div className="px-6 py-4 border-b border-gray-200">
                        <button
                          onClick={() => handleAddUser(UserRole.User, moderator.id)}
                          disabled={state.loading}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          <i className="fas fa-plus"></i>
                          <span>إضافة مستخدم جديد</span>
                        </button>
                      </div>

                      {managedUsers.length > 0 ? (
                        <div className="overflow-hidden rounded-lg border border-gray-200 m-4">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                                <th className="px-6 py-4 text-right text-sm font-semibold text-blue-900">
                                  الاسم
                                </th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-blue-900">
                                  اسم المستخدم
                                </th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-blue-900">
                                  آخر دخول
                                </th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-blue-900">
                                  الإجراءات
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {managedUsers.map((user, idx) => (
                                <tr
                                  key={user.id}
                                  className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                >
                                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">
                                    @{user.username}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">
                                    {formatDate(user.lastLogin)}
                                  </td>
                                  <td className="px-6 py-4 text-sm">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleEditUser(user)}
                                        title="تعديل"
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                                      >
                                        <i className="fas fa-edit"></i>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(user)}
                                        title="حذف"
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-6 py-8 text-center">
                          <p className="text-sm text-gray-600">
                            لا يوجد مستخدمون تابعون لهذا المشرف
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            )}
          </div>
        )}

        {/* Secondary Admins Section */}
        {activeTab === 'secondaryAdmins' && (
          <div className="space-y-6">
            {/* Secondary Admins Info Header */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
                <i className="fas fa-user-tie"></i>
                إدارة المديرين الثانويين
              </h3>
              <p className="text-sm text-orange-700 mt-2">
                يمكنك هنا إضافة وتعديل وإدارة بيانات المديرين الثانويين في النظام
              </p>
            </div>

            {/* Empty State for Secondary Admins */}
            {secondaryAdmins.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                <i className="fas fa-user-tie text-4xl text-gray-400 mb-4 block"></i>
                <p className="text-gray-600 mb-2">لا يوجد مديرون ثانويون</p>
                <p className="text-sm text-gray-500">
                  لا يوجد مديرون ثانويون متاحون حالياً
                </p>
              </div>
            )}

            {/* Secondary Admins Cards */}
            {currentUser?.role === UserRole.PrimaryAdmin && (
              <>
                {/* Add Secondary Admin Button */}
                <div>
                  <button
                    onClick={() => handleAddUser(UserRole.SecondaryAdmin)}
                    disabled={state.loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    <i className="fas fa-plus"></i>
                    <span>إضافة مدير ثانوي جديد</span>
                  </button>
                </div>
                {secondaryAdmins.length > 0 && (
                <div className="space-y-4">
              {secondaryAdmins.map((admin) => {
                const isExpanded = expandedSecondaryAdmins.has(admin.id);
                const roleInfo = getRoleInfo(admin.role);

                return (
                  <div
                    key={admin.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Secondary Admin Header */}
                    <div
                      onClick={() => toggleSecondaryAdmin(admin.id)}
                      className="w-full px-6 py-4 bg-orange-50 hover:bg-orange-100 transition-colors flex items-center justify-between text-right cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <i
                          className={`fas fa-chevron-down text-orange-600 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        ></i>
                        <div className="text-right">
                          <h3 className="font-semibold text-gray-900">
                            {admin.lastName ? `${admin.firstName} ${admin.lastName}` : admin.firstName}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditModerator(admin);
                          }}
                          title="تعديل المدير الثانوي"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModerator(admin);
                          }}
                          title="حذف المدير الثانوي"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    {/* Secondary Admin Details */}
                    {isExpanded && (
                      <div className="bg-white border-t border-gray-200 px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">تاريخ الإنشاء:</span>
                            <span className="text-sm text-gray-900 font-medium">{formatDate(admin.createdAt)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">آخر تحديث:</span>
                            <span className="text-sm text-gray-900 font-medium">{formatDate(admin.updatedAt)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">الحالة:</span>
                            <span className={`inline-flex items-center gap-2 ${admin.isActive ? 'text-green-600' : 'text-red-600'}`}>
                              <i className={`fas ${admin.isActive ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                              {admin.isActive ? 'نشط' : 'غير نشط'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Account Settings Section */}
        {activeTab === 'accountSettings' && (
          <div className="space-y-6">
            {/* Account Settings Header */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <i className="fas fa-user-cog"></i>
                معلومات الحساب
              </h3>
              <p className="text-sm text-blue-700 mt-2">
                يمكنك هنا تحديث بيانات حسابك الشخصية مثل الاسم واسم المستخدم وكلمة المرور
              </p>
            </div>

            {/* Account Info Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <i className="fas fa-user text-blue-600 text-lg"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">معلومات حسابك الحالية</h4>
                    <p className="text-sm text-gray-600">يمكنك تحديث بياناتك أدناه</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (currentUser) {
                      setSelectedUser(currentUser);
                      openModal('editAccount');
                    } else {
                      addToast('لم يتم العثور على بيانات المستخدم', 'error');
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                >
                  <i className="fas fa-edit"></i>
                  <span>تعديل البيانات</span>
                </button>
              </div>

              {/* Current Account Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium">الاسم الكامل</p>
                  <p className="text-sm text-gray-900 font-semibold mt-1">
                    {currentUser?.lastName 
                      ? `${currentUser?.firstName} ${currentUser?.lastName}`
                      : currentUser?.firstName || 'لم يتم تعيين'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium">اسم المستخدم</p>
                  <p className="text-sm text-gray-900 font-semibold mt-1">
                    {currentUser?.username || 'لم يتم تعيين'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium">نوع الحساب</p>
                  <p className="text-sm text-red-700 font-semibold mt-1 flex items-center gap-2">
                    <i className="fas fa-crown text-red-600"></i>
                    {currentUser?.role ? getRoleInfo(currentUser.role).label : 'غير معروف'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium">حالة الحساب</p>
                  <p className="text-sm text-green-700 font-semibold mt-1 flex items-center gap-2">
                    <i className="fas fa-check-circle text-green-600"></i>
                    نشط
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <i className="fas fa-lightbulb text-blue-600"></i>
                  نصائح الأمان
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>تأكد من استخدام كلمة مرور قوية تحتوي على أحرف وأرقام</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>غيّر كلمة المرور بانتظام لضمان أمان حسابك</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>تأكد من الخروج من حسابك عند استخدام أجهزة مشتركة</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Logs Section */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* Logs Header */}
            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                <i className="fas fa-history"></i>
                {currentUser?.role === UserRole.Moderator ? 'سجلات العمليات' : 'سجلات النظام'}
              </h3>
              <p className="text-sm text-purple-700 mt-2">
                {currentUser?.role === UserRole.Moderator
                  ? 'اعرض سجلات العمليات والأنشطة الخاصة بحسابك فقط'
                  : 'اعرض سجلات النظام مع مستويات الخطورة والرسائل المفصلة'}
              </p>
            </div>

            {/* Logs Filter Bar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex gap-4 flex-wrap items-end">
                {/* Search Filter */}
                <div className="flex-1 min-w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <i className="fas fa-search ml-1"></i>
                    بحث
                  </label>
                  <input
                    type="text"
                    placeholder="ابحث في السجلات..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>
                
                {/* Log Level Filter */}
                <div className="min-w-40">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <i className="fas fa-layer-group ml-1"></i>
                    مستوى السجل
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm">
                    <option value="">جميع المستويات</option>
                    <option value="verbose">Verbose - مفصل</option>
                    <option value="debug">Debug - تصحيح</option>
                    <option value="information">Information - معلومات</option>
                    <option value="warning">Warning - تحذير</option>
                    <option value="error">Error - خطأ</option>
                    <option value="fatal">Fatal - حرج</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div className="min-w-32">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <i className="fas fa-calendar ml-1"></i>
                    التاريخ
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Records Per Page Filter */}
                <div className="min-w-32">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <i className="fas fa-list ml-1"></i>
                    عدد السجلات
                  </label>
                  <select 
                    value={logsPerPage} 
                    onChange={(e) => setLogsPerPage(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value={10}>10 سجلات</option>
                    <option value={25}>25 سجل</option>
                    <option value={50}>50 سجل</option>
                    <option value={100}>100 سجل</option>
                  </select>
                </div>

                {/* Export Button */}
                <button 
                  onClick={handleExportLogs}
                  disabled={isExporting}
                  className="h-9 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap inline-flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <i className="fas fa-spinner animate-spin"></i>
                      جاري التصدير...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-download"></i>
                      تصدير
                    </>
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                  <i className="fas fa-info-circle ml-1"></i>
                  إجمالي السجلات: 1,247
                </span>
                <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  <i className="fas fa-exclamation-triangle ml-1"></i>
                  أخطاء: 23
                </span>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-purple-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase">الوقت</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase">المستوى</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase">الرسالة</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase">المصدر</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {/* Information Log */}
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">2025-11-04 14:30:22.156</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <i className="fas fa-info-circle"></i>
                          Information
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">User authenticated successfully</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">AuthService.cs:45</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog({
                          timestamp: '2025-11-04 14:30:22.156',
                          level: 'Information',
                          message: 'User authenticated successfully',
                          source: 'AuthService.cs:45',
                          userId: 'user_001',
                          userName: 'أحمد علي',
                          exception: null,
                          stackTrace: null,
                          properties: {
                            'UserId': 'user_001',
                            'Username': 'ahmad.ali',
                            'IpAddress': '192.168.1.100',
                            'UserAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                          }
                        })} className="text-purple-600 hover:text-purple-700 font-medium text-xs cursor-pointer">عرض</button>
                      </td>
                    </tr>

                    {/* Debug Log */}
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">2025-11-04 14:29:45.892</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <i className="fas fa-bug"></i>
                          Debug
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">Database query executed: SELECT * FROM Users</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">UserRepository.cs:123</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog({
                          timestamp: '2025-11-04 14:29:45.892',
                          level: 'Debug',
                          message: 'Database query executed: SELECT * FROM Users',
                          source: 'UserRepository.cs:123',
                          userId: 'user_002',
                          userName: 'فاطمة محمود',
                          exception: null,
                          stackTrace: null,
                          properties: {
                            'Query': 'SELECT * FROM Users WHERE IsActive = 1',
                            'ExecutionTime': '156ms',
                            'RowsReturned': '42',
                            'ConnectionString': 'Server=db.clinic.local;Database=ClinicDB'
                          }
                        })} className="text-purple-600 hover:text-purple-700 font-medium text-xs cursor-pointer">عرض</button>
                      </td>
                    </tr>

                    {/* Warning Log */}
                    <tr className="hover:bg-yellow-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">2025-11-04 14:28:10.445</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <i className="fas fa-exclamation"></i>
                          Warning
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">Slow query detected: execution time 2500ms</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">QueryExecutor.cs:78</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog({
                          timestamp: '2025-11-04 14:28:10.445',
                          level: 'Warning',
                          message: 'Slow query detected: execution time 2500ms',
                          source: 'QueryExecutor.cs:78',
                          userId: 'user_003',
                          userName: 'عمر حسن',
                          exception: null,
                          stackTrace: null,
                          properties: {
                            'QueryId': 'q_12345',
                            'ExecutionTime': '2500ms',
                            'Threshold': '1000ms',
                            'AffectedRecords': '5000',
                            'QueryHash': 'a1b2c3d4e5f6'
                          }
                        })} className="text-purple-600 hover:text-purple-700 font-medium text-xs cursor-pointer">عرض</button>
                      </td>
                    </tr>

                    {/* Error Log */}
                    <tr className="hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">2025-11-04 14:25:33.712</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <i className="fas fa-times-circle"></i>
                          Error
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">Connection timeout: Failed to connect to database</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">DbContext.cs:56</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog({
                          timestamp: '2025-11-04 14:25:33.712',
                          level: 'Error',
                          message: 'Connection timeout: Failed to connect to database',
                          source: 'DbContext.cs:56',
                          userId: 'system',
                          userName: 'النظام',
                          exception: 'SqlException: Timeout expired.',
                          stackTrace: 'at System.Data.SqlClient.SqlInternalConnection.OpenLoginEnlist(...)\n   at System.Data.SqlClient.SqlConnection.Open()',
                          properties: {
                            'ConnectionString': 'Server=db.clinic.local',
                            'Timeout': '30000ms',
                            'RetryCount': '3',
                            'LastAttempt': '2025-11-04 14:25:32.500'
                          }
                        })} className="text-purple-600 hover:text-purple-700 font-medium text-xs cursor-pointer">عرض</button>
                      </td>
                    </tr>

                    {/* Verbose Log */}
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">2025-11-04 14:22:15.334</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <i className="fas fa-comment"></i>
                          Verbose
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">Cache hit for key: patient_123</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">CacheService.cs:92</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog({
                          timestamp: '2025-11-04 14:22:15.334',
                          level: 'Verbose',
                          message: 'Cache hit for key: patient_123',
                          source: 'CacheService.cs:92',
                          userId: 'cache_engine',
                          userName: 'محرك التخزين المؤقت',
                          exception: null,
                          stackTrace: null,
                          properties: {
                            'CacheKey': 'patient_123',
                            'CacheDuration': '3600s',
                            'HitRate': '92.5%',
                            'EntrySize': '2.3KB',
                            'Provider': 'Redis'
                          }
                        })} className="text-purple-600 hover:text-purple-700 font-medium text-xs cursor-pointer">عرض</button>
                      </td>
                    </tr>

                    {/* Fatal Log */}
                    <tr className="hover:bg-red-100 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">2025-11-04 14:15:02.101</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-200 text-red-900">
                          <i className="fas fa-skull"></i>
                          Fatal
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-semibold">Application crash: Unhandled exception</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">Program.cs:1</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedLog({
                          timestamp: '2025-11-04 14:15:02.101',
                          level: 'Fatal',
                          message: 'Application crash: Unhandled exception',
                          source: 'Program.cs:1',
                          userId: 'system',
                          userName: 'النظام',
                          exception: 'NullReferenceException: Object reference not set to an instance of an object.',
                          stackTrace: 'at ClinicApp.Services.PatientService.GetPatient(String id) in PatientService.cs:line 45\n   at ClinicApp.Controllers.PatientsController.Get(String id) in PatientsController.cs:line 23',
                          properties: {
                            'ApplicationVersion': '1.0.0',
                            'EnvironmentName': 'Production',
                            'ProcessId': '5432',
                            'MemoryUsage': '512MB',
                            'CrashTime': '2025-11-04 14:15:01.999'
                          }
                        })} className="text-purple-600 hover:text-purple-700 font-medium text-xs cursor-pointer">عرض</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Log Details Modal Info */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <i className="fas fa-code"></i>
                معلومات مستويات السجلات
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                  <span><span className="font-medium">Verbose:</span> معلومات تفصيلية جداً</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-gray-500 rounded-full"></span>
                  <span><span className="font-medium">Debug:</span> معلومات التصحيح</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><span className="font-medium">Information:</span> معلومات عامة</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span><span className="font-medium">Warning:</span> تحذيرات</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                  <span><span className="font-medium">Error:</span> أخطاء</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-red-700 rounded-full"></span>
                  <span><span className="font-medium">Fatal:</span> أخطاء حرجة</span>
                </div>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                عرض {Math.min((currentPage - 1) * logsPerPage + 1, totalLogs)} إلى {Math.min(currentPage * logsPerPage, totalLogs)} من {totalLogs} سجل
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title="الصفحة السابقة"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
                {getPaginationPages().map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (typeof page === 'number') {
                        setCurrentPage(page);
                      }
                    }}
                    disabled={page === '...'}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : page === '...'
                        ? 'border border-gray-300 text-gray-600 cursor-default'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title="الصفحة التالية"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Users Section - For Moderators */}
        {activeTab === 'myUsers' && currentUser?.role === UserRole.Moderator && (
          <div className="space-y-6">
            {/* My Users Info Header */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                <i className="fas fa-users"></i>
                إدارة المستخدمين الخاصين بك
              </h3>
              <p className="text-sm text-green-700 mt-2">
                يمكنك هنا إضافة وتعديل وإدارة بيانات المستخدمين التابعين لك
              </p>
            </div>

            {/* Add User Button */}
            <div>
              <button
                onClick={() => handleAddUser(UserRole.User, currentUser.id)}
                disabled={state.loading}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <i className="fas fa-plus"></i>
                <span>إضافة مستخدم جديد</span>
              </button>
            </div>

            {/* Users List */}
            {myManagedUsers.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                <i className="fas fa-users text-4xl text-gray-400 mb-4 block"></i>
                <p className="text-gray-600 mb-2">لا توجد مستخدمون</p>
                <p className="text-sm text-gray-500">لا يوجد مستخدمون تابعون لك حالياً</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          المستخدم
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          اسم المستخدم
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          المعرف
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الحالة
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          آخر تسجيل دخول
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          الإجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {myManagedUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <i className="fas fa-user text-purple-600"></i>
                              </div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {user.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {user.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                user.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {user.isActive ? 'نشط' : 'غير نشط'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(user.lastLogin)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditUser(user)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                title="تعديل المستخدم"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                title="حذف المستخدم"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Authentication Section - For Moderators and Users */}
        {activeTab === 'whatsappAuth' && (currentUser?.role === UserRole.Moderator || currentUser?.role === UserRole.User) && (
          <div className="space-y-6">
            {/* WhatsApp Auth Header */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
                <i className="fab fa-whatsapp"></i>
                مصادقة واتساب
              </h3>
              <p className="text-sm text-emerald-700 mt-2">
                قم بربط حسابك بواتساب للبدء في إرسال الرسائل وإدارة قوائم الانتظار
              </p>
            </div>

            {/* Authentication Status Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <i className="fab fa-whatsapp text-emerald-600 text-xl"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">حالة الاتصال</h4>
                    <p className="text-sm text-gray-600">معلومات ربط حسابك بواتساب</p>
                  </div>
                </div>
                <span className="inline-flex px-4 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <i className="fas fa-times-circle ml-2"></i>
                  غير متصل
                </span>
              </div>

              <div className="space-y-4">
                {/* Last Authentication */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium mb-1">آخر مصادقة</p>
                  <p className="text-sm text-gray-900">لم يتم المصادقة بعد</p>
                </div>

                {/* Session Info */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium mb-1">معلومات الجلسة</p>
                  <p className="text-sm text-gray-900">لا توجد جلسة نشطة</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-700 transition-colors font-medium"
                  >
                    <i className="fab fa-whatsapp"></i>
                    <span>بدء المصادقة</span>
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 px-6 py-3 text-gray-700 hover:bg-gray-300 transition-colors font-medium"
                    disabled
                  >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>قطع الاتصال</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <i className="fas fa-info-circle"></i>
                كيفية المصادقة
              </h4>
              <ol className="text-sm text-blue-800 space-y-1 mr-4 list-decimal">
                <li>انقر على زر "بدء المصادقة" أعلاه</li>
                <li>سيظهر لك رمز QR على الشاشة</li>
                <li>افتح تطبيق واتساب على هاتفك</li>
                <li>اذهب إلى الإعدادات {'>'} الأجهزة المرتبطة</li>
                <li>امسح رمز QR الظاهر على الشاشة</li>
                <li>انتظر حتى يتم التأكيد والاتصال بنجاح</li>
              </ol>
            </div>
          </div>
        )}

        {/* Quota Section - For Moderators and Users */}
        {activeTab === 'quota' && (currentUser?.role === UserRole.Moderator || currentUser?.role === UserRole.User) && (
          <div className="space-y-6">
            {/* Quota Header */}
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                <i className="fas fa-chart-pie"></i>
                معلومات الحصة
              </h3>
              <p className="text-sm text-indigo-700 mt-2">
                {currentUser.role === UserRole.Moderator
                  ? 'اطلع على حصتك من الرسائل وقوائم الانتظار المتاحة'
                  : 'اطلع على حصة المشرف الخاص بك من الرسائل وقوائم الانتظار'}
              </p>
            </div>

            {/* Quota Display */}
            {currentUser.role === UserRole.Moderator && 'quota' in currentUser ? (
              <ModeratorQuotaDisplay
                moderatorId={currentUser.id}
                quota={(currentUser as any).quota as ModeratorQuota}
                onEditMessages={() => {}}
                onEditQueues={() => {}}
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                <i className="fas fa-chart-pie text-4xl text-gray-400 mb-4 block"></i>
                <p className="text-gray-600 mb-2">لا توجد معلومات حصة</p>
                <p className="text-sm text-gray-500">
                  {currentUser.role === UserRole.User
                    ? 'يتم مشاركة الحصة مع مشرفك'
                    : 'لم يتم تعيين حصة لحسابك'}
                </p>
              </div>
            )}

            {/* Quota Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-blue-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-envelope text-blue-600 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">حصة الرسائل</p>
                      <p className="text-2xl font-bold text-gray-900">-</p>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">0% مستخدم</p>
              </div>

              <div className="bg-white border border-purple-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-list text-purple-600 text-xl"></i>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">حصة قوائم الانتظار</p>
                      <p className="text-2xl font-bold text-gray-900">-</p>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">0% مستخدم</p>
              </div>
            </div>

            {/* Request Extra Quota Info */}
            {currentUser.role === UserRole.Moderator && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle"></i>
                  هل تحتاج إلى حصة إضافية؟
                </h4>
                <p className="text-sm text-yellow-800 mb-3">
                  إذا كنت بحاجة إلى زيادة حصتك من الرسائل أو قوائم الانتظار، يمكنك طلب ذلك من المدير
                </p>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 transition-colors text-sm font-medium"
                  disabled
                >
                  <i className="fas fa-paper-plane"></i>
                  <span>طلب حصة إضافية (قريباً)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <i className="fas fa-file-alt"></i>
                تفاصيل السجل
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-white hover:text-gray-200 text-xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border-l-4 border-purple-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">المستوى</p>
                  <p className="text-sm font-semibold mt-1">{selectedLog.level}</p>
                </div>
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">الوقت</p>
                  <p className="text-sm font-semibold mt-1">{selectedLog.timestamp}</p>
                </div>
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">المصدر</p>
                  <p className="text-xs font-semibold mt-1 font-mono">{selectedLog.source}</p>
                </div>
                <div className="border-l-4 border-orange-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">المستخدم</p>
                  <p className="text-sm font-semibold mt-1">{selectedLog.userName}</p>
                </div>
              </div>

              {/* Message */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-2">الرسالة</p>
                <p className="text-sm text-gray-900 font-mono break-words">{selectedLog.message}</p>
              </div>

              {/* Exception */}
              {selectedLog.exception && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs text-red-600 font-medium mb-2">الاستثناء</p>
                  <p className="text-sm text-red-900 font-mono break-words">{selectedLog.exception}</p>
                </div>
              )}

              {/* Stack Trace */}
              {selectedLog.stackTrace && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-2">تتبع المكدس</p>
                  <pre className="text-xs text-gray-900 overflow-x-auto whitespace-pre-wrap break-words">{selectedLog.stackTrace}</pre>
                </div>
              )}

              {/* Properties */}
              {selectedLog.properties && Object.keys(selectedLog.properties).length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-3">الخصائص الإضافية</p>
                  <div className="space-y-2">
                    {Object.entries(selectedLog.properties).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-start text-xs gap-4">
                        <span className="font-medium text-gray-700 flex-shrink-0">{key}:</span>
                        <span className="text-gray-600 font-mono text-right break-all flex-1">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                    addToast('تم نسخ التفاصيل إلى الحافظة', 'success');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <i className="fas fa-copy"></i>
                  نسخ
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                >
                  <i className="fas fa-times"></i>
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditUserModal selectedUser={selectedUser} />
      <EditAccountModal selectedUser={selectedUser} />
      <AddUserModal 
        onUserAdded={() => actions.fetchUsers()} 
        role={selectedRole}
        moderatorId={selectedModerator}
        onClose={() => setSelectedRole(null)}
      />
      <ModeratorQuotaModal
        isOpen={showQuotaModal}
        quota={selectedQuota || {
          id: '',
          moderatorId: selectedModeratorForQuota?.id || '',
          messagesQuota: { limit: -1, used: 0, percentage: 0, isLow: false, warningThreshold: 80 },
          queuesQuota: { limit: -1, used: 0, percentage: 0, isLow: false, warningThreshold: 80 },
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        moderatorName={selectedModeratorForQuota ? `${selectedModeratorForQuota.firstName} ${selectedModeratorForQuota.lastName}` : ''}
        onClose={() => {
          setShowQuotaModal(false);
          setSelectedModeratorForQuota(null);
          setSelectedQuota(null);
        }}
        onSave={handleSaveQuota}
        isLoading={quotaSaving}
      />
      <ModeratorMessagesQuotaModal
        isOpen={showMessagesQuotaModal}
        quota={selectedQuota || {
          id: '',
          moderatorId: selectedModeratorForQuota?.id || '',
          messagesQuota: { limit: -1, used: 0, percentage: 0, isLow: false, warningThreshold: 80 },
          queuesQuota: { limit: -1, used: 0, percentage: 0, isLow: false, warningThreshold: 80 },
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        moderatorName={selectedModeratorForQuota ? `${selectedModeratorForQuota.firstName} ${selectedModeratorForQuota.lastName}` : ''}
        moderatorData={selectedModeratorForQuota}
        onClose={() => {
          setShowMessagesQuotaModal(false);
          setSelectedModeratorForQuota(null);
          setSelectedQuota(null);
        }}
        onSave={handleSaveQuota}
        isLoading={quotaSaving}
      />
      <ModeratorQueuesQuotaModal
        isOpen={showQueuesQuotaModal}
        quota={selectedQuota || {
          id: '',
          moderatorId: selectedModeratorForQuota?.id || '',
          messagesQuota: { limit: -1, used: 0, percentage: 0, isLow: false, warningThreshold: 80 },
          queuesQuota: { limit: -1, used: 0, percentage: 0, isLow: false, warningThreshold: 80 },
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
        moderatorName={selectedModeratorForQuota ? `${selectedModeratorForQuota.firstName} ${selectedModeratorForQuota.lastName}` : ''}
        moderatorData={selectedModeratorForQuota}
        onClose={() => {
          setShowQueuesQuotaModal(false);
          setSelectedModeratorForQuota(null);
          setSelectedQuota(null);
        }}
        onSave={handleSaveQuota}
        isLoading={quotaSaving}
      />
    </>
  );
}
