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
 * Mock moderator data
 */
interface ModeratorExtended {
  id: string;
  name: string;
  email: string;
  messagesQuota: number;
  queuesQuota: number;
  consumedMessages: number;
  consumedQueues: number;
  whatsappStatus: 'متصل' | 'غير متصل' | 'في الانتظار';
  lastAuth?: string;
  isActive: boolean;
}

const MOCK_MODERATORS: ModeratorExtended[] = [
  {
    id: '2',
    name: 'أحمد علي',
    email: 'ahmed@clinic.com',
    messagesQuota: 500,
    queuesQuota: 10,
    consumedMessages: 340,
    consumedQueues: 8,
    whatsappStatus: 'متصل',
    lastAuth: '2025-01-25 02:15 PM',
    isActive: true,
  },
  {
    id: '3',
    name: 'فاطمة محمد',
    email: 'fatima@clinic.com',
    messagesQuota: 450,
    queuesQuota: 10,
    consumedMessages: 280,
    consumedQueues: 6,
    whatsappStatus: 'متصل',
    lastAuth: '2025-01-24 11:30 PM',
    isActive: true,
  },
];

/**
 * Management Panel - Enhanced admin features
 * Features:
 * - User management with full CRUD
 * - Moderator management and monitoring
 * - Quota management with visual progress
 * - WhatsApp connection status
 * - Audit logs and permissions
 * - System settings
 */
export default function ManagementPanel() {
  const [state, actions] = useUserManagement();
  const [activeTab, setActiveTab] = useState<'users' | 'moderators' | 'quotas' | 'settings'>('users');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [selectedModeratorId, setSelectedModeratorId] = useState<string | null>(null);
  const [quotaForm, setQuotaForm] = useState({
    messagesQuota: 0,
    queuesQuota: 0,
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.User,
    assignedModerator: '',
  });
  const [showBulkQuotaModal, setShowBulkQuotaModal] = useState(false);
  const [bulkQuotaForm, setBulkQuotaForm] = useState({
    messagesQuota: 0,
    queuesQuota: 0,
  });
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [expandedModerators, setExpandedModerators] = useState<Set<string>>(new Set());
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<string | null>(null);
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    newPassword: '',
    confirmPassword: '',
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
   * Handle edit moderator button click - memoized
   */
  const handleEditModerator = useCallback((moderator: ModeratorExtended) => {
    setFormData({
      name: moderator.name,
      email: moderator.email,
      role: UserRole.Moderator,
      assignedModerator: '',
    });
    setEditingId(moderator.id);
    setShowCreateForm(true);
  }, []);

  /**
   * Handle delete moderator button click - memoized
   */
  const handleDeleteModerator = useCallback(async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المشرف؟')) {
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
   * Filter users based on search term, role, and status - memoized with advanced filtering
   */
  const filteredUsers = useMemo(
    () =>
      displayUsers.filter((user) => {
        // Text search filter
        const searchMatch =
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase());

        // Role filter
        const roleMatch = filterRole === 'all' || user.role === filterRole;

        // Status filter
        const statusMatch = filterStatus === 'all' || (filterStatus === 'active' ? user.isActive : !user.isActive);

        return searchMatch && roleMatch && statusMatch;
      }),
    [displayUsers, searchTerm, filterRole, filterStatus]
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

  /**
   * Toggle user selection for bulk operations - memoized
   */
  const handleToggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  /**
   * Select all visible users - memoized
   */
  const handleSelectAllUsers = useCallback(() => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
    }
  }, [filteredUsers, selectedUsers]);

  /**
   * Export users to CSV with proper UTF-8 encoding for Excel - memoized
   */
  const handleExportUsers = useCallback(() => {
    const headers = ['الاسم', 'البريد الإلكتروني', 'الدور', 'حالة النشاط', 'تاريخ الإنشاء'];
    const data = filteredUsers.map((user) => [
      user.name,
      user.email,
      getRoleDisplayName(user.role),
      user.isActive ? 'نشط' : 'معطّل',
      new Date(user.createdAt).toLocaleDateString('ar-SA'),
    ]);

    // Create CSV content with proper formatting
    const csvRows = [headers, ...data].map((row) => 
      row.map((cell) => {
        // Escape quotes and wrap in quotes
        const escaped = String(cell).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    ).join('\n');

    // Add UTF-8 BOM to fix Excel encoding issues with Arabic text
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows;

    // Create and download CSV with proper mime type for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredUsers, getRoleDisplayName]);

  /**
   * Bulk delete users - memoized
   */
  const handleBulkDeleteUsers = useCallback(async () => {
    if (selectedUsers.size === 0) return;

    if (confirm(`هل أنت متأكد من حذف ${selectedUsers.size} مستخدم؟`)) {
      for (const userId of selectedUsers) {
        await actions.deleteUser(userId);
      }
      setSelectedUsers(new Set());
    }
  }, [selectedUsers, actions]);

  /**
   * Apply bulk quota update to selected moderators - memoized
   */
  const handleBulkQuotaUpdate = useCallback(async () => {
    if (selectedUsers.size === 0) return;

    // Update quotas for selected moderators
    for (const moderatorId of selectedUsers) {
      const moderator = MOCK_MODERATORS.find((m) => m.id === moderatorId);
      if (moderator) {
        moderator.messagesQuota = bulkQuotaForm.messagesQuota;
        moderator.queuesQuota = bulkQuotaForm.queuesQuota;
      }
    }

    setShowBulkQuotaModal(false);
    setSelectedUsers(new Set());
    setBulkQuotaForm({ messagesQuota: 0, queuesQuota: 0 });
  }, [selectedUsers, bulkQuotaForm]);

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

          {/* Advanced Filters & Search */}
          <div className="space-y-4 bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
                <i className="fas fa-search text-gray-400"></i>
                <input
                  type="text"
                  placeholder="ابحث عن مستخدم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-0 py-1 border-0 focus:outline-none focus:ring-0 bg-transparent text-sm"
                />
              </div>

              {/* Role Filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">جميع الأدوار</option>
                <option value={UserRole.PrimaryAdmin}>مدير أساسي</option>
                <option value={UserRole.SecondaryAdmin}>مدير ثانوي</option>
                <option value={UserRole.Moderator}>مشرف</option>
                <option value={UserRole.User}>مستخدم</option>
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">نشط</option>
                <option value="inactive">معطّل</option>
              </select>

              {/* Actions */}
              <button
                onClick={handleExportUsers}
                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <i className="fas fa-download"></i>
                تصدير CSV
              </button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedUsers.size > 0 && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <span className="text-sm text-blue-800 font-medium">
                  {selectedUsers.size} مستخدم محدد
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDeleteUsers}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-trash"></i>
                    حذف
                  </button>
                  <button
                    onClick={() => setSelectedUsers(new Set())}
                    className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400 transition-colors"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>
            )}
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

          {/* Users Table with Checkboxes */}
          {!state.loading && filteredUsers.length > 0 && !showCreateForm && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-8">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                          onChange={handleSelectAllUsers}
                          className="rounded cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">البريد الإلكتروني</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الدور</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-24">آخر دخول</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 w-20">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleToggleUserSelection(user.id)}
                            className="rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <Badge label={getRoleDisplayName(user.role)} color={getRoleColor(user.role)} />
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-600' : 'bg-gray-600'}`}></div>
                            {user.isActive ? 'نشط' : 'معطّل'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-SA') : 'لم يسجل'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-1 justify-center">
                            <RequireFeature feature={Feature.EDIT_USER}>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                title="تعديل"
                              >
                                <i className="fas fa-edit text-sm"></i>
                              </button>
                            </RequireFeature>
                            <RequireFeature feature={Feature.DELETE_USER}>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-800 p-1 transition-colors"
                                title="حذف"
                              >
                                <i className="fas fa-trash text-sm"></i>
                              </button>
                            </RequireFeature>
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

      {/* Moderators Tab */}
      {activeTab === 'moderators' && (
        <div className="space-y-6">
          {/* Bulk Operations */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
              <span className="text-sm text-blue-800 font-medium">
                {selectedUsers.size} مشرف محدد
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkQuotaModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-chart-bar"></i>
                  تحديث الحصص
                </button>
                <button
                  onClick={() => setSelectedUsers(new Set())}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-400 transition-colors"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          {/* Moderators Table */}
          {MOCK_MODERATORS.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-8">
                        <input
                          type="checkbox"
                          checked={selectedUsers.size === MOCK_MODERATORS.length && MOCK_MODERATORS.length > 0}
                          onChange={() => {
                            if (selectedUsers.size === MOCK_MODERATORS.length) {
                              setSelectedUsers(new Set());
                            } else {
                              setSelectedUsers(new Set(MOCK_MODERATORS.map((m) => m.id)));
                            }
                          }}
                          className="rounded cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-24">الحالة</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">البريد الإلكتروني</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">حالة واتساب</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الحصة (الرسائل/الطوابير)</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-32">آخر دخول</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 w-20">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {MOCK_MODERATORS.map((moderator) => {
                      const messagesPercent = (moderator.consumedMessages / moderator.messagesQuota) * 100;
                      const queuesPercent = (moderator.consumedQueues / moderator.queuesQuota) * 100;
                      const assignedUsers = MOCK_USERS.filter(user => user.assignedModerator === moderator.id);
                      
                      return (
                        <React.Fragment key={moderator.id}>
                          {/* Moderator Row */}
                          <tr className="hover:bg-gray-50 transition-colors bg-white">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.has(moderator.id)}
                                  onChange={() => handleToggleUserSelection(moderator.id)}
                                  className="rounded cursor-pointer"
                                />
                                {assignedUsers.length > 0 && (
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedModerators);
                                      if (newExpanded.has(moderator.id)) {
                                        newExpanded.delete(moderator.id);
                                      } else {
                                        newExpanded.add(moderator.id);
                                      }
                                      setExpandedModerators(newExpanded);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 transition-colors p-0.5"
                                    title={expandedModerators.has(moderator.id) ? 'طي المستخدمين' : 'عرض المستخدمين'}
                                  >
                                    <i className={`fas ${expandedModerators.has(moderator.id) ? 'fa-chevron-down' : 'fa-chevron-left'} text-sm`}></i>
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${moderator.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                <span className="text-xs text-gray-600">{moderator.isActive ? 'نشط' : 'معطّل'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{moderator.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{moderator.email}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                moderator.whatsappStatus === 'متصل' ? 'bg-green-100 text-green-800' :
                                moderator.whatsappStatus === 'في الانتظار' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                <i className={`fas fa-circle text-xs ${
                                  moderator.whatsappStatus === 'متصل' ? 'text-green-600' :
                                  moderator.whatsappStatus === 'في الانتظار' ? 'text-yellow-600' :
                                  'text-gray-600'
                                }`}></i>
                                {moderator.whatsappStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <div className="space-y-2">
                                <div>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-gray-700 font-medium text-xs">الرسائل</span>
                                    <span className="text-gray-600 text-xs">{messagesPercent.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full ${messagesPercent > 80 ? 'bg-red-500' : messagesPercent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(messagesPercent, 100)}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-0.5">{moderator.consumedMessages}/{moderator.messagesQuota}</div>
                                </div>
                                <div>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-gray-700 font-medium text-xs">الطوابير</span>
                                    <span className="text-gray-600 text-xs">{queuesPercent.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full ${queuesPercent > 80 ? 'bg-red-500' : queuesPercent > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(queuesPercent, 100)}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-0.5">{moderator.consumedQueues}/{moderator.queuesQuota}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-600">{moderator.lastAuth}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => {
                                    setSelectedModeratorId(moderator.id);
                                    setQuotaForm({
                                      messagesQuota: moderator.messagesQuota,
                                      queuesQuota: moderator.queuesQuota,
                                    });
                                    setShowQuotaModal(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                  title="تعديل الحصة - تحديث حصص الرسائل والطوابير"
                                >
                                  <i className="fas fa-chart-bar text-sm"></i>
                                </button>
                                <RequireFeature feature={Feature.EDIT_USER}>
                                  <button
                                    onClick={() => handleEditModerator(moderator)}
                                    className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                    title="تعديل المشرف"
                                  >
                                    <i className="fas fa-edit text-sm"></i>
                                  </button>
                                </RequireFeature>
                                <RequireFeature feature={Feature.DELETE_USER}>
                                  <button
                                    onClick={() => handleDeleteModerator(moderator.id)}
                                    className="text-red-600 hover:text-red-800 p-1 transition-colors"
                                    title="حذف المشرف"
                                  >
                                    <i className="fas fa-trash text-sm"></i>
                                  </button>
                                </RequireFeature>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Assigned Users Rows (Hierarchical Display - Expandable) */}
                          {expandedModerators.has(moderator.id) && assignedUsers.map((user) => (
                            <tr key={`user-${user.id}`} className="hover:bg-blue-50 transition-colors bg-blue-50 border-l-4 border-blue-300 animate-in fade-in duration-200">
                              <td className="px-6 py-3"></td>
                              <td className="px-6 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                  <span className="text-xs text-gray-600">{user.isActive ? 'نشط' : 'معطّل'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-arrow-left text-blue-400 text-xs"></i>
                                  <span className="font-medium text-gray-900">{user.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-600">{user.email}</td>
                              <td className="px-6 py-3 text-sm">
                                <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-full">
                                  {getRoleDisplayName(user.role)}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-xs text-gray-600">-</td>
                              <td className="px-6 py-3 text-xs text-gray-600">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-SA') : '-'}</td>
                              <td className="px-6 py-3 text-center">
                                <div className="flex gap-1 justify-center">
                                  <RequireFeature feature={Feature.EDIT_USER}>
                                    <button
                                      onClick={() => handleEditUser(user)}
                                      className="text-blue-600 hover:text-blue-800 p-1 transition-colors"
                                      title="تعديل المستخدم"
                                    >
                                      <i className="fas fa-edit text-sm"></i>
                                    </button>
                                  </RequireFeature>
                                  <RequireFeature feature={Feature.DELETE_USER}>
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-red-600 hover:text-red-800 p-1 transition-colors"
                                      title="حذف المستخدم"
                                    >
                                      <i className="fas fa-trash text-sm"></i>
                                    </button>
                                  </RequireFeature>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bulk Quota Modal */}
          {showBulkQuotaModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">تحديث الحصص للمشرفين المحددين</h3>
                  <button
                    onClick={() => setShowBulkQuotaModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">سيتم تطبيق الحصة على {selectedUsers.size} مشرف</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">حصة الرسائل</label>
                    <input
                      type="number"
                      value={bulkQuotaForm.messagesQuota}
                      onChange={(e) => setBulkQuotaForm({ ...bulkQuotaForm, messagesQuota: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="أدخل حصة الرسائل"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">حصة الطوابير</label>
                    <input
                      type="number"
                      value={bulkQuotaForm.queuesQuota}
                      onChange={(e) => setBulkQuotaForm({ ...bulkQuotaForm, queuesQuota: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="أدخل حصة الطوابير"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={handleBulkQuotaUpdate}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    تطبيق
                  </button>
                  <button
                    onClick={() => setShowBulkQuotaModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Individual Quota Modal */}
          {showQuotaModal && selectedModeratorId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">تعديل الحصة</h3>
                  <button
                    onClick={() => setShowQuotaModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">حصة الرسائل</label>
                    <input
                      type="number"
                      value={quotaForm.messagesQuota}
                      onChange={(e) => setQuotaForm({ ...quotaForm, messagesQuota: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">حصة الطوابير</label>
                    <input
                      type="number"
                      value={quotaForm.queuesQuota}
                      onChange={(e) => setQuotaForm({ ...quotaForm, queuesQuota: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setShowQuotaModal(false)}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    حفظ
                  </button>
                  <button
                    onClick={() => setShowQuotaModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quotas Tab */}
      {activeTab === 'quotas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_MODERATORS.map((moderator) => {
              const messagesPercent = (moderator.consumedMessages / moderator.messagesQuota) * 100;
              const queuesPercent = (moderator.consumedQueues / moderator.queuesQuota) * 100;
              return (
                <div key={moderator.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">{moderator.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">مشرف</span>
                  </div>

                  <div className="space-y-6">
                    {/* Messages Quota */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <i className="fas fa-envelope text-blue-600"></i>
                          الرسائل
                        </label>
                        <span className="text-sm font-semibold text-gray-900">{moderator.consumedMessages} / {moderator.messagesQuota}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            messagesPercent > 80 ? 'bg-red-500' :
                            messagesPercent > 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(messagesPercent, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{messagesPercent.toFixed(1)}% مستخدم</div>
                    </div>

                    {/* Queues Quota */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <i className="fas fa-layer-group text-purple-600"></i>
                          الطوابير
                        </label>
                        <span className="text-sm font-semibold text-gray-900">{moderator.consumedQueues} / {moderator.queuesQuota}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            queuesPercent > 80 ? 'bg-red-500' :
                            queuesPercent > 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(queuesPercent, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{queuesPercent.toFixed(1)}% مستخدم</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedModeratorId(moderator.id);
                      setQuotaForm({
                        messagesQuota: moderator.messagesQuota,
                        queuesQuota: moderator.queuesQuota,
                      });
                      setShowQuotaModal(true);
                    }}
                    className="w-full mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-edit"></i>
                    تعديل الحصة
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* WhatsApp Authentication Section */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <i className="fab fa-whatsapp text-white text-xl"></i>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">تكامل واتساب</h2>
                  <p className="text-sm text-gray-600 mt-1">إدارة المصادقة والاتصال</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-gray-700">الحالة</span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold">
                    <i className="fas fa-circle text-green-600 text-xs"></i>
                    متصل
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">آخر دخول</span>
                  <i className="fas fa-phone text-green-600 text-lg"></i>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-2">2025-01-25 02:15 PM</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">عدد الاتصالات</span>
                  <i className="fas fa-chart-line text-green-600 text-lg"></i>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-2">1,240</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">وقت الاتصال</span>
                  <i className="fas fa-clock text-green-600 text-lg"></i>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-2">15:42:30</p>
              </div>
            </div>

            <div className="flex gap-3">
              <RequireFeature feature={Feature.EDIT_SYSTEM_SETTINGS}>
                <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2">
                  <i className="fas fa-sync-alt"></i>
                  إعادة المصادقة
                </button>
              </RequireFeature>
              <button className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center gap-2">
                <i className="fas fa-info-circle"></i>
                التفاصيل
              </button>
            </div>
          </div>

          {/* System Settings Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <i className="fas fa-sliders-h text-blue-600"></i>
                إعدادات النظام
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* Password Change Management */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <i className="fas fa-key text-orange-600"></i>
                  إدارة كلمات المرور
                </h4>
                <p className="text-sm text-gray-600 mb-4">تغيير كلمة مرور المستخدمين من قبل المسؤولين</p>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {displayUsers.filter(u => u.role === UserRole.User || u.role === UserRole.Moderator).map(user => (
                    <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <RequireFeature feature={Feature.EDIT_SYSTEM_SETTINGS}>
                        <button
                          onClick={() => {
                            setSelectedUserForPassword(user.id);
                            setPasswordChangeForm({ newPassword: '', confirmPassword: '' });
                            setShowPasswordChangeModal(true);
                          }}
                          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors flex items-center gap-2"
                        >
                          <i className="fas fa-edit"></i>
                          تغيير كلمة المرور
                        </button>
                      </RequireFeature>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Configuration */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <i className="fas fa-cog text-purple-600"></i>
                  تكوين النظام
                </h4>
                
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm font-medium text-gray-700 block mb-2">الحد الأقصى للرسائل اليومية</label>
                    <input type="number" defaultValue={10000} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm font-medium text-gray-700 block mb-2">الحد الأقصى للطوابير</label>
                    <input type="number" defaultValue={50} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="text-sm font-medium text-gray-700 block mb-2">مدة جلسة الخمول (دقائق)</label>
                    <input type="number" defaultValue={30} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* Backup and Maintenance */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <i className="fas fa-shield-alt text-red-600"></i>
                  النسخ الاحتياطية والصيانة
                </h4>

                <div className="flex gap-3">
                  <RequireFeature feature={Feature.EDIT_SYSTEM_SETTINGS}>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center gap-2">
                      <i className="fas fa-download"></i>
                      إنشاء نسخة احتياطية
                    </button>
                  </RequireFeature>
                  <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 transition-colors flex items-center gap-2">
                    <i className="fas fa-clock"></i>
                    السجلات
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChangeModal && selectedUserForPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <i className="fas fa-lock text-orange-600"></i>
                تغيير كلمة المرور
              </h3>
              <button
                onClick={() => setShowPasswordChangeModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                المستخدم: <strong>{displayUsers.find(u => u.id === selectedUserForPassword)?.name}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={passwordChangeForm.newPassword}
                  onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="أدخل كلمة المرور الجديدة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  value={passwordChangeForm.confirmPassword}
                  onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                />
              </div>

              {passwordChangeForm.newPassword && passwordChangeForm.confirmPassword && passwordChangeForm.newPassword !== passwordChangeForm.confirmPassword && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">كلمات المرور غير متطابقة!</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowPasswordChangeModal(false);
                  setSelectedUserForPassword(null);
                }}
                className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                تحديث كلمة المرور
              </button>
              <button
                onClick={() => setShowPasswordChangeModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 mt-6">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          نصائح للاستخدام الأمثل:
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
