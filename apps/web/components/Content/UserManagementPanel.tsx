'use client';

import React, { useState, useEffect } from 'react';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserRole } from '@/types/roles';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { User } from '@/services/userManagementService';
import EditUserModal from '@/components/Modals/EditUserModal';
import AddUserModal from '@/components/Modals/AddUserModal';

/**
 * UserManagementPanel - Manage moderators and their users
 * Features:
 * - Display moderators with expandable user lists
 * - Show users managed by each moderator
 * - Create, Edit, Delete users
 * - Collapsible sections per moderator
 */
export default function UserManagementPanel() {
  const [state, actions] = useUserManagement();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedModerators, setExpandedModerators] = useState<Set<string>>(new Set());
  const [expandedSecondaryAdmins, setExpandedSecondaryAdmins] = useState<Set<string>>(new Set());

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
  const getRoleInfo = (role: UserRole) => {
    switch (role) {
      case UserRole.PrimaryAdmin:
        return { label: 'المدير الأساسي', color: 'bg-red-100 text-red-800' };
      case UserRole.SecondaryAdmin:
        return { label: 'مدير ثانوي', color: 'bg-orange-100 text-orange-800' };
      case UserRole.Moderator:
        return { label: 'مشرف', color: 'bg-green-100 text-green-800' };
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

  const handleAddUser = (moderatorId?: string) => {
    setSelectedUser(null);
    if (moderatorId) {
      // Store moderator ID for context when adding user to moderator
      (window as any).__selectedModeratorId = moderatorId;
    }
    openModal('addUser');
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    openModal('editUser');
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف المستخدم: ${user.name}؟`);
    if (!confirmed) return;

    const success = await actions.deleteUser(user.id);
    if (success) {
      addToast(`تم حذف المستخدم ${user.name} بنجاح`, 'success');
      setSelectedUser(null);
    }
  };

  const handleEditModerator = (moderator: User) => {
    setSelectedUser(moderator);
    openModal('editUser');
  };

  const handleDeleteModerator = async (moderator: User) => {
    const confirmed = window.confirm(`هل أنت متأكد من حذف المشرف: ${moderator.name}؟`);
    if (!confirmed) return;

    const success = await actions.deleteUser(moderator.id);
    if (success) {
      addToast(`تم حذف المشرف ${moderator.name} بنجاح`, 'success');
      setSelectedUser(null);
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

  const moderators = getModerators();
  const secondaryAdmins = getSecondaryAdmins();
  const regularUsers = state.users.filter((u) => u.role === UserRole.User);

  return (
    <PanelWrapper>
      <PanelHeader
        title="إدارة المستخدمين"
        icon="fa-users"
        description="إدارة المديرين والمشرفين والمستخدمين"
        stats={[
          {
            label: 'إجمالي المستخدمين',
            value: moderators.length + secondaryAdmins.length + regularUsers.length,
            icon: 'fa-users',
            color: 'blue',
          },
          {
            label: 'المشرفون',
            value: moderators.length,
            icon: 'fa-user-shield',
            color: 'green',
          },
          {
            label: 'المديرون الثانويون',
            value: secondaryAdmins.length,
            icon: 'fa-user-tie',
            color: 'yellow',
          },
          {
            label: 'المستخدمون العاديون',
            value: regularUsers.length,
            icon: 'fa-user',
            color: 'purple',
          },
        ]}
        actions={[
          {
            label: 'إضافة مستخدم',
            icon: 'fa-plus',
            onClick: () => handleAddUser(),
            variant: 'primary',
          },
        ]}
      />
      {/* Error Alert */}
      {state.error && (
        <div className="mx-6 mt-4 rounded-lg bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Loading State */}
        {state.loading && moderators.length === 0 && (
          <div className="flex justify-center py-12">
            <div className="animate-spin">
              <i className="fas fa-spinner text-2xl text-blue-600"></i>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!state.loading && moderators.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
            <i className="fas fa-users text-4xl text-gray-400 mb-4 block"></i>
            <p className="text-gray-600 mb-2">لا توجد مشرفون</p>
            <p className="text-sm text-gray-500">
              لا يوجد مشرفون متاحون حالياً
            </p>
          </div>
        )}

        {/* Moderators with Users */}
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
                  <button
                    onClick={() => toggleModerator(moderator.id)}
                    className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-right"
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
                          {moderator.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
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
                  </button>

                  {/* Managed Users Table */}
                  {isExpanded && (
                    <div className="bg-white border-t border-gray-200">
                      {/* Add User Button for this Moderator */}
                      <div className="px-6 py-4 border-b border-gray-200">
                        <button
                          onClick={() => handleAddUser(moderator.id)}
                          disabled={state.loading}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          <i className="fas fa-plus"></i>
                          <span>إضافة مستخدم</span>
                        </button>
                      </div>

                      {managedUsers.length > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="bg-blue-50">
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                                الاسم
                              </th>
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                                اسم المستخدم
                              </th>
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                                آخر دخول
                              </th>
                              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                                الإجراءات
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {managedUsers.map((user) => (
                              <tr
                                key={user.id}
                                className="border-t border-gray-200 hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                  {user.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {user.username}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {formatDate(user.lastLogin)}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditUser(user)}
                                      title="تعديل"
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                      <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user)}
                                      title="حذف"
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

      {/* Modals */}
      <EditUserModal selectedUser={selectedUser} />
      <AddUserModal onUserAdded={() => actions.fetchUsers()} />
    </PanelWrapper>
  );
}
