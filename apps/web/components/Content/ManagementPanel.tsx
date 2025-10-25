'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useCanAccess } from '@/hooks/useAuthz';
import { Feature, UserRole } from '@/types/roles';
import RequireFeature from '@/components/Common/RequireFeature';
import { User } from '@/services/userManagementService';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import { TabNavigation } from '@/components/Common/TabNavigation';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { FormSection, FormField, TextInput, SelectField } from '@/components/Common/FormComponents';
import { Badge } from '@/components/Common/ResponsiveUI';

/**
 * Mock users for demonstration/development
 */
const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'سيف الدين محمد',
    email: 'saif@clinic.com',
    role: UserRole.PrimaryAdmin,
    assignedModerator: undefined,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    isActive: true,
  },
  {
    id: '2',
    name: 'أحمد علي',
    email: 'ahmed@clinic.com',
    role: UserRole.Moderator,
    assignedModerator: '1',
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date('2024-02-20'),
    isActive: true,
  },
  {
    id: '3',
    name: 'فاطمة محمد',
    email: 'fatima@clinic.com',
    role: UserRole.Moderator,
    assignedModerator: '1',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-10'),
    isActive: true,
  },
  {
    id: '4',
    name: 'خالد السلام',
    email: 'khaled@clinic.com',
    role: UserRole.User,
    assignedModerator: '2',
    createdAt: new Date('2024-04-05'),
    updatedAt: new Date('2024-04-05'),
    isActive: true,
  },
  {
    id: '5',
    name: 'نور الهدى',
    email: 'noor@clinic.com',
    role: UserRole.User,
    assignedModerator: '3',
    createdAt: new Date('2024-05-12'),
    updatedAt: new Date('2024-05-12'),
    isActive: true,
  },
];

/**
 * Management Panel - Admin features for system management
 * SOLID: Single Responsibility - Orchestrates admin/management UI
 * SOLID: Open/Closed - Extensible for new admin features
 * 
 * Features by role:
 * - Primary Admin: Full user management, settings, audit logs
 * - Secondary Admin: Moderator management, quotas
 * - Moderator: Profile settings only
 * - User: Profile settings only
 * 
 * Enhanced with responsive components and improved UX
 */
export default function ManagementPanel() {
  const [state, actions] = useUserManagement();
  const [activeTab, setActiveTab] = useState<'users' | 'moderators' | 'quotas' | 'settings'>('users');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.User,
    assignedModerator: '',
  });

  const canViewUsers = useCanAccess(Feature.VIEW_USERS);
  const canCreateUser = useCanAccess(Feature.CREATE_USER);
  const canEditUser = useCanAccess(Feature.EDIT_USER);
  const canDeleteUser = useCanAccess(Feature.DELETE_USER);
  const canManageModerators = useCanAccess(Feature.MANAGE_MODERATORS);
  const canEditQuotas = useCanAccess(Feature.EDIT_QUOTAS);
  const canViewAuditLogs = useCanAccess(Feature.VIEW_AUDIT_LOGS);
  const canEditSettings = useCanAccess(Feature.EDIT_SYSTEM_SETTINGS);

  // Use mock data if no users or permission denied
  const displayUsers = state.users.length === 0 || !canViewUsers ? MOCK_USERS : state.users;

  /**
   * Handle user form submission - memoized for optimization
   */
  const handleSubmitUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      return;
    }

    if (editingId) {
      await actions.updateUser(editingId, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        assignedModerator: formData.assignedModerator || undefined,
      });
      setEditingId(null);
    } else {
      await actions.createUser({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        assignedModerator: formData.assignedModerator || undefined,
      });
    }

    setFormData({
      name: '',
      email: '',
      role: UserRole.User,
      assignedModerator: '',
    });
    setShowCreateForm(false);
  }, [editingId, formData, actions]);

  /**
   * Handle edit button click - memoized
   */
  const handleEditUser = useCallback((user: User) => {
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      assignedModerator: user.assignedModerator || '',
    });
    setEditingId(user.id);
    setShowCreateForm(true);
  }, []);

  /**
   * Handle delete button click - memoized
   */
  const handleDeleteUser = useCallback(async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      await actions.deleteUser(id);
    }
  }, [actions]);

  /**
   * Handle cancel - memoized
   */
  const handleCancel = useCallback(() => {
    setShowCreateForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      role: UserRole.User,
      assignedModerator: '',
    });
  }, []);

  /**
   * Filter users based on search term - memoized
   */
  const filteredUsers = useMemo(
    () =>
      displayUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [displayUsers, searchTerm]
  );

  /**
   * Get role display name in Arabic - memoized
   */
  const getRoleDisplayName = useCallback((role: UserRole): string => {
    const roleMap: Record<UserRole, string> = {
      [UserRole.PrimaryAdmin]: 'المدير الأساسي',
      [UserRole.SecondaryAdmin]: 'المدير الثانوي',
      [UserRole.Moderator]: 'مشرف',
      [UserRole.User]: 'مستخدم',
    };
    return roleMap[role];
  }, []);

  /**
   * Get role color - memoized
   */
  const getRoleColor = useCallback((role: UserRole): 'blue' | 'red' | 'yellow' | 'gray' => {
    const colorMap: Record<UserRole, 'blue' | 'red' | 'yellow' | 'gray'> = {
      [UserRole.PrimaryAdmin]: 'red',
      [UserRole.SecondaryAdmin]: 'yellow',
      [UserRole.Moderator]: 'blue',
      [UserRole.User]: 'gray',
    };
    return colorMap[role];
  }, []);

  /**
   * Prepare tab data - memoized
   */
  const tabs = useMemo(() => [
    {
      id: 'users',
      label: 'إدارة المستخدمين',
      icon: 'fa-users',
      enabled: canViewUsers,
    },
    {
      id: 'moderators',
      label: 'إدارة المشرفين',
      icon: 'fa-user-tie',
      enabled: canManageModerators,
    },
    {
      id: 'quotas',
      label: 'إدارة الحصص',
      icon: 'fa-chart-bar',
      enabled: canEditQuotas,
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: 'fa-cog',
      enabled: canEditSettings,
    },
  ], [canViewUsers, canManageModerators, canEditQuotas, canEditSettings]);

  /**
   * Prepare table columns for users - memoized
   */
  const userTableColumns = useMemo(
    () => [
      { key: 'name', label: 'الاسم', width: '20%' },
      { key: 'email', label: 'البريد الإلكتروني', width: '25%' },
      { key: 'role', label: 'الدور', width: '15%' },
      { key: 'lastLogin', label: 'آخر تسجيل دخول', width: '20%' },
      { key: 'actions', label: 'الإجراءات', width: '20%' },
    ],
    []
  );

  /**
   * Prepare table data for users - memoized
   */
  const userTableData = useMemo(
    () =>
      filteredUsers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: <Badge label={getRoleDisplayName(user.role)} color={getRoleColor(user.role)} />,
        lastLogin: user.lastLogin
          ? new Date(user.lastLogin).toLocaleDateString('ar-SA')
          : 'لم يسجل دخول',
      })),
    [filteredUsers, getRoleDisplayName, getRoleColor]
  );

  /**
   * Render row actions for users table
   */
  const renderUserActions = useCallback(
    (row: any) => (
      <div className="flex gap-2 justify-center">
        <RequireFeature feature={Feature.EDIT_USER}>
          <button
            onClick={() => {
              const user = state.users.find((u) => u.id === row.id);
              if (user) handleEditUser(user);
            }}
            className="text-blue-600 hover:text-blue-800 p-2 transition-colors"
            title="تعديل"
          >
            <i className="fas fa-edit"></i>
          </button>
        </RequireFeature>
        <RequireFeature feature={Feature.DELETE_USER}>
          <button
            onClick={() => handleDeleteUser(row.id)}
            className="text-red-600 hover:text-red-800 p-2 transition-colors"
            title="حذف"
          >
            <i className="fas fa-trash"></i>
          </button>
        </RequireFeature>
      </div>
    ),
    [displayUsers, handleEditUser, handleDeleteUser]
  );

  return (
    <PanelWrapper isLoading={state.loading && !showCreateForm}>
      <PanelHeader
        title="لوحة الإدارة"
        icon="fa-sliders-h"
        description="إدارة المستخدمين والمشرفين والإعدادات النظامية"
        stats={[
          {
            label: 'إجمالي المستخدمين',
            value: displayUsers.length.toString(),
            icon: 'fa-users',
          },
          {
            label: 'المشرفون',
            value: state.moderators.length.toString(),
            icon: 'fa-user-tie',
          },
        ]}
      />

      {/* Error Alert */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-red-800 font-semibold mb-1">خطأ</h3>
              <p className="text-red-700 text-sm">{state.error}</p>
            </div>
            <button
              onClick={actions.clearError}
              className="text-red-600 hover:text-red-800 transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <TabNavigation
        tabs={tabs.map((tab) => ({
          ...tab,
          id: tab.id as 'users' | 'moderators' | 'quotas' | 'settings',
        }))}
        activeTabId={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId as 'users' | 'moderators' | 'quotas' | 'settings');
          setShowCreateForm(false);
        }}
      />

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Create User Button */}
          <RequireFeature feature={Feature.CREATE_USER}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              <span>إضافة مستخدم جديد</span>
            </button>
          </RequireFeature>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <FormSection title={editingId ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}>
              <form onSubmit={handleSubmitUser} className="space-y-4">
                <FormField label="الاسم" required>
                  <TextInput
                    value={formData.name}
                    onChange={(value) => setFormData({ ...formData, name: value })}
                    placeholder="أدخل اسم المستخدم"
                  />
                </FormField>

                <FormField label="البريد الإلكتروني" required>
                  <TextInput
                    type="email"
                    value={formData.email}
                    onChange={(value) => setFormData({ ...formData, email: value })}
                    placeholder="أدخل البريد الإلكتروني"
                  />
                </FormField>

                <FormField label="الدور" required>
                  <SelectField
                    value={formData.role}
                    onChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                    options={[
                      { value: UserRole.User, label: 'مستخدم' },
                      { value: UserRole.Moderator, label: 'مشرف' },
                      { value: UserRole.SecondaryAdmin, label: 'مدير ثانوي' },
                      { value: UserRole.PrimaryAdmin, label: 'مدير أساسي' },
                    ]}
                  />
                </FormField>

                {formData.role === UserRole.User && (
                  <FormField label="المشرف المعين">
                    <SelectField
                      value={formData.assignedModerator}
                      onChange={(value) => setFormData({ ...formData, assignedModerator: value.toString() })}
                      options={[
                        { value: '', label: 'بدون مشرف' },
                        ...state.moderators.map((mod) => ({ value: mod.id, label: mod.name })),
                      ]}
                    />
                  </FormField>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={state.loading}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-save"></i>
                    {state.loading ? 'جاري المعالجة...' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </FormSection>
          )}

          {/* Search */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-2">
            <i className="fas fa-search text-gray-400"></i>
            <input
              type="text"
              placeholder="ابحث عن مستخدم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-0 py-1 border-0 focus:outline-none focus:ring-0 bg-transparent"
            />
          </div>

          {/* Empty State */}
          {!state.loading && filteredUsers.length === 0 && !showCreateForm && (
            <EmptyState
              icon="fa-users"
              title="لا توجد مستخدمين"
              message={searchTerm ? 'لم يتم العثور على نتائج' : 'ابدأ بإضافة مستخدم جديد'}
              actionLabel={canCreateUser && !searchTerm ? 'إضافة مستخدم أول' : undefined}
              onAction={canCreateUser && !searchTerm ? () => setShowCreateForm(true) : undefined}
            />
          )}

          {/* Users Table */}
          {!state.loading && filteredUsers.length > 0 && !showCreateForm && (
            <ResponsiveTable
              columns={userTableColumns}
              data={userTableData}
              keyField="id"
              rowActions={(row) => renderUserActions(row)}
              emptyMessage="لا توجد مستخدمين"
            />
          )}
        </div>
      )}

      {/* Moderators Tab */}
      {activeTab === 'moderators' && (
        <EmptyState
          icon="fa-user-tie"
          title="إدارة المشرفين"
          message="إدارة تعيين المشرفين للمستخدمين وإدارة مسؤولياتهم"
        />
      )}

      {/* Quotas Tab */}
      {activeTab === 'quotas' && (
        <EmptyState
          icon="fa-chart-bar"
          title="إدارة الحصص"
          message="تحديد حدود الطوابير اليومية والشهرية لكل مستخدم"
        />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <EmptyState
          icon="fa-cog"
          title="الإعدادات"
          message="إدارة إعدادات النظام والتكاملات الخارجية"
        />
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 mt-6">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          نصائح:
        </h4>
        <ul className="text-blue-800 text-sm space-y-1 mr-6">
          <li>• استخدم البحث للعثور على المستخدمين بسرعة</li>
          <li>• يمكنك تعديل أي بيانات مستخدم بنقرة واحدة</li>
          <li>• احذر عند حذف المستخدمين - لا يمكن التراجع</li>
        </ul>
      </div>
    </PanelWrapper>
  );
}
