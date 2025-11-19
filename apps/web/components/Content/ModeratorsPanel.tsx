'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ModeratorDetails, CreateModeratorRequest, UpdateModeratorRequest, AddUserToModeratorRequest } from '@/types/moderator';
import moderatorsService from '@/services/moderatorsService';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { useUserManagement } from '@/hooks/useUserManagement';

interface ModeratorsState {
  moderators: ModeratorDetails[];
  loading: boolean;
  error: string | null;
  selectedModerator: ModeratorDetails | null;
}

/**
 * ModeratorsPanel - Complete moderator management interface
 * Features:
 * - View all moderators with stats
 * - Create new moderators
 * - Edit moderator details
 * - Manage moderator users
 * - View quota usage
 * - Check WhatsApp status
 */
export default function ModeratorsPanel() {
  const { confirm } = useConfirmDialog();
  const [, userManagementActions] = useUserManagement();
  const [state, setState] = useState<ModeratorsState>({
    moderators: [],
    loading: true,
    error: null,
    selectedModerator: null,
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'users' | 'quota'>('overview');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [_showEditForm, setShowEditForm] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function to get user display name following priority:
  // 1. firstName + lastName (if both exist)
  // 2. firstName (if lastName is null/empty)
  // 3. المشرف #${id} (ID-based fallback)
  // 4. username (last fallback)
  const getUserDisplayName = (user: { firstName: string; lastName?: string; username: string; id?: string | number }): string => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.id) {
      return `المشرف #${user.id}`;
    }
    return user.username || 'Unknown';
  };

  const [formData, setFormData] = useState<CreateModeratorRequest>({
    firstName: '',
    lastName: '',
    username: '',
    messagesQuota: 1000,
    queuesQuota: 10,
  });

  const [editFormData, _setEditFormData] = useState<UpdateModeratorRequest>({});
  const [userFormData, setUserFormData] = useState<AddUserToModeratorRequest>({
    firstName: '',
    lastName: '',
    username: '',
  });

  // Fetch moderators on mount
  useEffect(() => {
    fetchModerators();
  }, []);

  const fetchModerators = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await moderatorsService.getAllModerators();
      if (response.success && response.data) {
        setState((prev) => ({
          ...prev,
          moderators: response.data as unknown as ModeratorDetails[],
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error || 'Failed to fetch moderators',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch moderators',
      }));
    }
  }, []);

  const handleCreateModerator = useCallback(async () => {
    if (!formData.firstName || !formData.lastName || !formData.username) {
      setState((prev) => ({
        ...prev,
        error: 'Please fill in all required fields',
      }));
      return;
    }

    try {
      const response = await moderatorsService.createModerator(formData);
      if (response.success) {
        await fetchModerators();
        // Refetch moderators in sidebar (Navigation component uses userManagementState.moderators)
        await userManagementActions.fetchModerators();
        setShowCreateForm(false);
        setFormData({
          firstName: '',
          lastName: '',
          username: '',
          messagesQuota: 1000,
          queuesQuota: 10,
        });
        // Dispatch event to refresh PanelHeader stats
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error || 'Failed to create moderator',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to create moderator',
      }));
    }
  }, [formData, fetchModerators]);

  const handleUpdateModerator = useCallback(async () => {
    if (!state.selectedModerator) return;

    try {
      const response = await moderatorsService.updateModerator(
        state.selectedModerator.id,
        editFormData
      );
      if (response.success) {
        await fetchModerators();
        // Refetch moderators in sidebar (Navigation component uses userManagementState.moderators)
        await userManagementActions.fetchModerators();
        setShowEditForm(false);
        setState((prev) => ({ ...prev, selectedModerator: null }));
        // Dispatch event to refresh PanelHeader stats
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error || 'Failed to update moderator',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to update moderator',
      }));
    }
  }, [state.selectedModerator, editFormData, fetchModerators]);

  const handleDeleteModerator = useCallback(async (moderatorId: number) => {
    const confirmed = await confirm(createDeleteConfirmation('المشرف'));
    if (!confirmed) return;

    try {
      const response = await moderatorsService.deleteModerator(moderatorId);
      if (response.success) {
        await fetchModerators();
        // Refetch moderators in sidebar (Navigation component uses userManagementState.moderators)
        await userManagementActions.fetchModerators();
        // Refresh sidebar queues (moderator's queues are now deleted)
        // Note: refreshQueues might not be available in this component, so we dispatch events
        // Dispatch events to refresh PanelHeader stats, sidebar queues, and moderators list
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
        window.dispatchEvent(new CustomEvent('queueDataUpdated'));
        window.dispatchEvent(new CustomEvent('moderatorDataUpdated'));
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error || 'Failed to delete moderator',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to delete moderator',
      }));
    }
  }, [fetchModerators, confirm]);

  const handleAddUserToModerator = useCallback(async () => {
    if (!state.selectedModerator || !userFormData.firstName || !userFormData.lastName || !userFormData.username) {
      setState((prev) => ({
        ...prev,
        error: 'Please fill in all required fields',
      }));
      return;
    }

    try {
      const response = await moderatorsService.addUserToModerator(
        state.selectedModerator.id,
        userFormData
      );
      if (response.success) {
        await fetchModerators();
        setShowAddUserModal(false);
        setUserFormData({
          firstName: '',
          lastName: '',
          username: '',
        });
        // Dispatch event to refresh PanelHeader stats
        window.dispatchEvent(new CustomEvent('userDataUpdated'));
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error || 'Failed to add user',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to add user',
      }));
    }
  }, [state.selectedModerator, userFormData, fetchModerators]);

  const filteredModerators = state.moderators.filter((m) => {
    const fullName = getUserDisplayName(m);
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           m.username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <PanelWrapper isLoading={state.loading}>
      <PanelHeader
        title="إدارة المشرفين"
        icon="fa-user-tie"
        description="إنشاء وإدارة المشرفين ومستخدميهم"
        stats={[
          {
            label: 'إجمالي المشرفين',
            value: state.moderators.length.toString(),
            icon: 'fa-user-tie',
          },
          {
            label: 'إجمالي المستخدمين',
            value: state.moderators.reduce((sum, m) => sum + m.managedUsersCount, 0).toString(),
            icon: 'fa-users',
          },
        ]}
      />

      {/* Error Alert */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-red-900">خطأ</h3>
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
            <button
              onClick={() => setState((prev) => ({ ...prev, error: null }))}
              className="text-red-400 hover:text-red-600"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        {(['overview', 'details', 'users', 'quota'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'overview' && '📋 نظرة عامة'}
            {tab === 'details' && '📝 التفاصيل'}
            {tab === 'users' && '👥 المستخدمون'}
            {tab === 'quota' && '📊 الحصة'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Search and Create */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute right-3 top-3 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="ابحث عن مشرف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              إضافة مشرف
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-bold text-lg mb-4">إضافة مشرف جديد</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="الاسم الأول"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="الاسم الأخير"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="اسم المستخدم"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="حصة الرسائل"
                  value={formData.messagesQuota}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      messagesQuota: parseInt(e.target.value),
                    })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="حصة الطوابير"
                  value={formData.queuesQuota}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      queuesQuota: parseInt(e.target.value),
                    })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCreateModerator}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  إنشاء
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Moderators Grid */}
          {filteredModerators.length === 0 ? (
            <EmptyState
              icon="fa-user-tie"
              title="لا توجد مشرفين"
              message="ابدأ بإضافة مشرف جديد للنظام"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModerators.map((moderator) => (
                <div
                  key={moderator.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900">{getUserDisplayName(moderator)}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="text-gray-500">@</span>
                        {moderator.username}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ml-2 ${
                      moderator.isActive
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {moderator.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </div>

                  {/* Detailed Info */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">المعرف:</span>
                      <span className="text-sm font-mono font-medium text-gray-900">{moderator.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">الحالة:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {moderator.isActive ? '✅ مفعّل' : '❌ معطّل'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">تاريخ الإنشاء:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(moderator.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">آخر تحديث:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(moderator.updatedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-4 pb-4 border-b">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">المستخدمون:</span>
                      <span className="font-semibold">{moderator.managedUsersCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">الطوابير:</span>
                      <span className="font-semibold">{moderator.queuesCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">القوالب:</span>
                      <span className="font-semibold">{moderator.templatesCount}</span>
                    </div>
                  </div>

                  {/* WhatsApp Status */}
                  <div className="mb-4 pb-4 border-b">
                    <div className="flex items-center gap-2">
                      <i className="fab fa-whatsapp text-green-600"></i>
                      <span className="text-sm">
                        {moderator.whatsappSession?.status === 'connected'
                          ? '✅ متصل'
                          : moderator.whatsappSession?.status === 'pending'
                          ? '⏳ في الانتظار'
                          : '❌ غير متصل'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          selectedModerator: moderator,
                        }));
                        setShowEditForm(true);
                      }}
                      className="flex-1 text-blue-600 hover:text-blue-800 py-2 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <i className="fas fa-edit mr-2"></i>
                      تعديل
                    </button>
                    <button
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          selectedModerator: moderator,
                        }));
                        setActiveTab('users');
                      }}
                      className="flex-1 text-green-600 hover:text-green-800 py-2 rounded border border-green-200 hover:bg-green-50 transition-colors"
                    >
                      <i className="fas fa-users mr-2"></i>
                      المستخدمون
                    </button>
                    <button
                      onClick={() => handleDeleteModerator(moderator.id)}
                      className="flex-1 text-red-600 hover:text-red-800 py-2 rounded border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <i className="fas fa-trash mr-2"></i>
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quota Tab */}
      {activeTab === 'quota' && (
        <div className="space-y-6">
          <h3 className="font-bold text-lg">استخدام الحصة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModerators.map((moderator) => {
              const messagesPercent = moderator.quota.messagesQuota.percentage;
              const queuesPercent = moderator.quota.queuesQuota.percentage;

              return (
                <div
                  key={moderator.id}
                  className="bg-white border border-gray-200 rounded-lg p-6"
                >
                  <h4 className="font-bold text-gray-900 mb-4">{getUserDisplayName(moderator)}</h4>

                  {/* Messages Quota */}
                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">الرسائل</span>
                      <span className="text-sm font-semibold">
                        {moderator.quota.messagesQuota.used} / {moderator.quota.messagesQuota.limit === -1 ? 'غير محدود' : moderator.quota.messagesQuota.limit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          messagesPercent > 80
                            ? 'bg-red-500'
                            : messagesPercent > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(messagesPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Queues Quota */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">الطوابير</span>
                      <span className="text-sm font-semibold">
                        {moderator.quota.queuesQuota.used} / {moderator.quota.queuesQuota.limit === -1 ? 'غير محدود' : moderator.quota.queuesQuota.limit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          queuesPercent > 80
                            ? 'bg-red-500'
                            : queuesPercent > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(queuesPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && state.selectedModerator && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">
              مستخدمو {getUserDisplayName(state.selectedModerator)}
            </h3>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>
              إضافة مستخدم
            </button>
          </div>

          {/* Add User Modal */}
          {showAddUserModal && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-bold text-lg mb-4">إضافة مستخدم جديد</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="الاسم الأول"
                  value={userFormData.firstName}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, firstName: e.target.value })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="الاسم الأخير"
                  value={userFormData.lastName}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, lastName: e.target.value })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="اسم المستخدم"
                  value={userFormData.username}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, username: e.target.value })
                  }
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddUserToModerator}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  إضافة
                </button>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Users Table */}
          {state.selectedModerator.managedUsersCount === 0 ? (
            <EmptyState
              icon="fa-user"
              title="لا يوجد مستخدمون"
              message="لم يتم إضافة أي مستخدمين لهذا المشرف بعد"
            />
          ) : (
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">البريد الإلكتروني</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">اسم المستخدم</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {state.selectedModerator.managedUsersCount > 0 && (
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">عينة مستخدم</td>
                      <td className="px-6 py-4 text-sm">user@clinic.com</td>
                      <td className="px-6 py-4 text-sm">user_name</td>
                      <td className="px-6 py-4 text-center">
                        <button className="text-red-600 hover:text-red-800">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PanelWrapper>
  );
}
