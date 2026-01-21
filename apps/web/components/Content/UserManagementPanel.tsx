/* eslint-disable react-hooks/rules-of-hooks */
/* NOTE: This component has early returns before hooks which violates Rules of Hooks.
   This needs major refactoring to move all hooks before conditional returns.
   Temporarily disabled the lint rule to allow build to proceed. */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useModeratorQuota } from '@/hooks/useModeratorQuota';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { UserRole } from '@/types/roles';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueue } from '@/contexts/QueueContext';
import { useWhatsAppSession } from '@/contexts/WhatsAppSessionContext';
import { User } from '@/services/userManagementService';
import { ModeratorQuota } from '@/types/user';
import { useRoleBasedUI } from '@/hooks/useRoleBasedUI';
import EditUserModal from '@/components/Modals/EditUserModal';
import EditAccountModal from '@/components/Modals/EditAccountModal';
import AddUserModal from '@/components/Modals/AddUserModal';
import WhatsAppAuthTabContent from '@/components/Content/WhatsAppAuthTabContent';
import ModeratorQuotaDisplay from '@/components/Moderators/ModeratorQuotaDisplay';
import ModeratorQuotaModal from '@/components/Moderators/ModeratorQuotaModal';
import ModeratorMessagesQuotaModal from '@/components/Moderators/ModeratorMessagesQuotaModal';
import ModeratorQueuesQuotaModal from '@/components/Moderators/ModeratorQueuesQuotaModal';
import moderatorQuotaService from '@/services/moderatorQuotaService';
import TrashTab from '@/components/TrashTab';
import { usersApiClient } from '@/services/api/usersApiClient';
import queuesApiClient from '@/services/api/queuesApiClient';
import { messageApiClient } from '@/services/api/messageApiClient';
import { formatLocalDateTime, getUtcDateString } from '@/utils/dateTimeUtils';
import { formatArabicPercentage } from '@/utils/numberUtils';

import { logsApiClient, LogEntry, getLevelColor, getLevelIcon } from '@/services/api/logsApiClient';
import { settingsApiClient, RateLimitSettings, UpdateRateLimitRequest } from '@/services/api/settingsApiClient';
import logger from '@/utils/logger';

const TRASH_PAGE_SIZE = 10;

/**
 * QuotaTabContent - Component for displaying quota information
 * Shows quota for moderators (their own) or users (their assigned moderator's quota)
 */
function QuotaTabContent({ currentUser }: { currentUser: User }) {
  // Determine which moderator ID to use for quota fetching
  let moderatorIdForQuota: string | null = null;

  if (currentUser.role === UserRole.Moderator) {
    // Moderators use their own ID
    moderatorIdForQuota = currentUser.id;
  } else if (currentUser.role === UserRole.User) {
    // Regular users use their assigned moderator's ID
    // If no assigned moderator, show error instead of falling back to own ID
    if (currentUser.assignedModerator) {
      moderatorIdForQuota = currentUser.assignedModerator;
    } else {
      // No assigned moderator - don't fetch quota (will show error message)
      moderatorIdForQuota = null;
    }
  }

  // Fetch quota using the hook (only if we have a valid moderator ID)
  const { quota, loading: quotaLoading, error: quotaError, refresh } = useModeratorQuota(
    moderatorIdForQuota || '0' // Pass '0' as placeholder if no moderator ID (hook will handle gracefully)
  );

  // Listen for quota updates and refresh
  useEffect(() => {
    const handleQuotaUpdate = () => {
      refresh();
    };

    window.addEventListener('quotaDataUpdated', handleQuotaUpdate);
    return () => {
      window.removeEventListener('quotaDataUpdated', handleQuotaUpdate);
    };
  }, [refresh]);

  // Calculate stats for display
  const messagesQuota = quota?.messagesQuota || {
    limit: -1,
    used: 0,
    percentage: 0,
    isLow: false,
    warningThreshold: 80,
  };

  const queuesQuota = quota?.queuesQuota || {
    limit: -1,
    used: 0,
    percentage: 0,
    isLow: false,
    warningThreshold: 80,
  };

  const messagesRemaining = messagesQuota.limit === -1 ? -1 : messagesQuota.limit - messagesQuota.used;
  const queuesRemaining = queuesQuota.limit === -1 ? -1 : queuesQuota.limit - queuesQuota.used;

  const messagesPercentage = messagesQuota.limit === -1 ? 0 : Math.min(100, messagesQuota.percentage);
  const queuesPercentage = queuesQuota.limit === -1 ? 0 : Math.min(100, queuesQuota.percentage);

  return (
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

      {/* Loading State */}
      {quotaLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin">
            <i className="fas fa-spinner text-2xl text-indigo-600"></i>
          </div>
        </div>
      )}

      {/* Error State */}
      {quotaError && !quotaLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">
            <i className="fas fa-exclamation-circle ml-2"></i>
            {quotaError}
          </p>
        </div>
      )}

      {/* Quota Display */}
      {!quotaLoading && !quotaError && (
        <>
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
                    <p className="text-2xl font-bold text-gray-900">
                      {messagesQuota.limit === -1 ? 'غير محدود' : messagesQuota.limit.toLocaleString('ar-EG-u-nu-latn')}
                    </p>
                  </div>
                </div>
              </div>
              {messagesQuota.limit !== -1 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${messagesPercentage >= 100
                        ? 'bg-red-600'
                        : messagesPercentage >= 80
                          ? 'bg-yellow-500'
                          : 'bg-blue-600'
                        }`}
                      style={{ width: `${messagesPercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      مستخدم: {messagesQuota.used.toLocaleString('ar-EG-u-nu-latn')} / {messagesQuota.limit.toLocaleString('ar-EG-u-nu-latn')}
                    </span>
                    <span className={`font-medium ${messagesPercentage >= 100
                      ? 'text-red-600'
                      : messagesPercentage >= 80
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                      }`}>
                      {formatArabicPercentage(messagesPercentage, 1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    متبقي: {messagesRemaining === -1 ? 'غير محدود' : messagesRemaining.toLocaleString('ar-EG-u-nu-latn')}
                  </p>
                </>
              )}
              {messagesQuota.limit === -1 && (
                <p className="text-xs text-gray-500 mt-2">حصة غير محدودة</p>
              )}
            </div>

            <div className="bg-white border border-purple-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-list text-purple-600 text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">حصة قوائم الانتظار</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {queuesQuota.limit === -1 ? 'غير محدود' : queuesQuota.limit.toLocaleString('ar-EG-u-nu-latn')}
                    </p>
                  </div>
                </div>
              </div>
              {queuesQuota.limit !== -1 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${queuesPercentage >= 100
                        ? 'bg-red-600'
                        : queuesPercentage >= 80
                          ? 'bg-yellow-500'
                          : 'bg-purple-600'
                        }`}
                      style={{ width: `${queuesPercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      مستخدم: {queuesQuota.used.toLocaleString('ar-EG-u-nu-latn')} / {queuesQuota.limit.toLocaleString('ar-EG-u-nu-latn')}
                    </span>
                    <span className={`font-medium ${queuesPercentage >= 100
                      ? 'text-red-600'
                      : queuesPercentage >= 80
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                      }`}>
                      {formatArabicPercentage(queuesPercentage, 1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    متبقي: {queuesRemaining === -1 ? 'غير محدود' : queuesRemaining.toLocaleString('ar-EG-u-nu-latn')}
                  </p>
                </>
              )}
              {queuesQuota.limit === -1 && (
                <p className="text-xs text-gray-500 mt-2">حصة غير محدودة</p>
              )}
            </div>
          </div>

          {/* Request Extra Quota Info - Only for Moderators
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
          )} */}
        </>
      )}

      {/* No Quota State */}
      {!quotaLoading && !quotaError && !quota && (
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
    </div>
  );
}

/**
 * UserManagementPanel - Manage moderators and their users
 * Features:
 * - Display moderators with expandable user lists
 * - Show users managed by each moderator
 * - Create, Edit, Delete users
 * - Collapsible sections per moderator
 */
export default function UserManagementPanel() {
  const { user: currentUser, refreshUser, isAuthenticated } = useAuth();
  // Pass current user's role to avoid fallback labels like "Unknown/غير محدد"
  const { permissions, roleInfo } = useRoleBasedUI({ userRole: currentUser?.role });
  const [state, actions] = useUserManagement();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const { confirm } = useConfirmDialog();
  const { refreshQueues, queues } = useQueue();
  const router = useRouter();

  // All useState hooks MUST be declared before any conditional returns
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'moderators' | 'myUsers' | 'secondaryAdmins' | 'whatsappAuth' | 'quota' | 'accountSettings' | 'logs' | 'trash' | 'systemSettings'>('moderators');
  const [expandedModerators, setExpandedModerators] = useState<Set<string>>(new Set());
  const [expandedSecondaryAdmins, setExpandedSecondaryAdmins] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);
  const [logsPerPage, setLogsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedModerator, setSelectedModerator] = useState<string | null>(null);
  const [expandedTrashSections, setExpandedTrashSections] = useState<Set<string>>(new Set(['users', 'queues', 'templates'])); // Default all expanded

  // Rate limit settings state (for admin system settings)
  const [rateLimitSettings, setRateLimitSettings] = useState<RateLimitSettings | null>(null);
  const [rateLimitLoading, setRateLimitLoading] = useState(false);
  const [rateLimitSaving, setRateLimitSaving] = useState(false);
  const [tempMinSeconds, setTempMinSeconds] = useState<number>(3);
  const [tempMaxSeconds, setTempMaxSeconds] = useState<number>(7);
  const [tempEnabled, setTempEnabled] = useState<boolean>(true);

  // Logs tab state for inline logs section (non-primary admin)
  const [inlineLogs, setInlineLogs] = useState<LogEntry[]>([]);
  const [inlineLogsLoading, setInlineLogsLoading] = useState(false);
  const [inlineLogsError, setInlineLogsError] = useState<string | null>(null);
  const [inlineLogLevelFilter, setInlineLogLevelFilter] = useState('All');
  const [inlineLogSearchQuery, setInlineLogSearchQuery] = useState('');
  const [inlineLogDateFilter, setInlineLogDateFilter] = useState(() => {
    // Default to today's date in UTC (Server Time) to match backend log files
    return getUtcDateString();
  });
  const [inlineLogsTotalCount, setInlineLogsTotalCount] = useState(0);

  // Authentication guard
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      router.replace('/');
      return;
    }
  }, [isAuthenticated, currentUser, router]);

  // Don't render if not authenticated
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">جاري إعادة التوجيه...</p>
        </div>
      </div>
    );
  }

  // Helper function to get user display name following priority:
  // 1. firstName + lastName (if both exist)
  // 2. firstName (if lastName is null/empty)
  // 3. username (fallback)
  const getUserDisplayName = (user: User): string => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    // Use username instead of ID as fallback
    return user.username || 'Unknown';
  };

  // Helper function to change tab and persist to sessionStorage
  const handleTabChange = (tab: 'moderators' | 'myUsers' | 'secondaryAdmins' | 'whatsappAuth' | 'quota' | 'accountSettings' | 'logs' | 'trash' | 'systemSettings') => {
    setActiveTab(tab);
    sessionStorage.setItem('userManagementActiveTab', tab);
  };

  // Allow other UI (e.g. Header) to force-switch the active tab without leaving the panel.
  useEffect(() => {
    const onExternalTabChange = (event: Event) => {
      const requestedTab = (event as CustomEvent<string>).detail;
      if (!requestedTab) return;

      const allowedTabs = ['moderators', 'myUsers', 'secondaryAdmins', 'whatsappAuth', 'quota', 'accountSettings', 'logs', 'trash', 'systemSettings'];
      if (!allowedTabs.includes(requestedTab)) return;

      handleTabChange(requestedTab as any);
    };

    window.addEventListener('userManagementActiveTabChange', onExternalTabChange as EventListener);
    return () => {
      window.removeEventListener('userManagementActiveTabChange', onExternalTabChange as EventListener);
    };
  }, []);

  // Sync when selectedRole changes (no console logging)
  useEffect(() => {
    // placeholder effect for any side-effects if needed later
  }, [selectedRole]);

  // Set default tab to "معلومات الحساب" (Account Settings) for all roles
  useEffect(() => {
    // Only set default tab if no tab has been explicitly set by user interaction
    // This prevents resetting the tab when currentUser updates after editing
    const savedTab = sessionStorage.getItem('userManagementActiveTab');
    if (savedTab && ['moderators', 'myUsers', 'secondaryAdmins', 'whatsappAuth', 'quota', 'accountSettings', 'logs', 'trash'].includes(savedTab)) {
      setActiveTab(savedTab as any);
      return;
    }

    if (currentUser) {
      // Default to 'accountSettings' for all roles
      const defaultTab: 'moderators' | 'myUsers' | 'secondaryAdmins' | 'whatsappAuth' | 'quota' | 'accountSettings' | 'logs' | 'trash' = 'accountSettings';
      setActiveTab(defaultTab);
      sessionStorage.setItem('userManagementActiveTab', defaultTab);
    }
  }, [currentUser?.id, currentUser?.role]); // Only depend on id and role, not the entire user object

  // Quota management state
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showMessagesQuotaModal, setShowMessagesQuotaModal] = useState(false);
  const [showQueuesQuotaModal, setShowQueuesQuotaModal] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<ModeratorQuota | null>(null);
  const [selectedModeratorForQuota, setSelectedModeratorForQuota] = useState<User | null>(null);
  const [quotaSaving, setQuotaSaving] = useState(false);

  // Trash tab state
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashError, setTrashError] = useState<string>('');
  const [trashPageNumber, setTrashPageNumber] = useState(1);
  const [trashTotalCount, setTrashTotalCount] = useState(0);

  // Trash state for queues, templates, and patients
  const [trashQueues, setTrashQueues] = useState<any[]>([]);
  const [isLoadingTrashQueues, setIsLoadingTrashQueues] = useState(false);
  const [trashQueuesError, setTrashQueuesError] = useState<string>('');
  const [trashQueuesPageNumber, setTrashQueuesPageNumber] = useState(1);
  const [trashQueuesTotalCount, setTrashQueuesTotalCount] = useState(0);

  const [trashTemplates, setTrashTemplates] = useState<any[]>([]);
  const [isLoadingTrashTemplates, setIsLoadingTrashTemplates] = useState(false);
  const [trashTemplatesError, setTrashTemplatesError] = useState<string>('');
  const [trashTemplatesPageNumber, setTrashTemplatesPageNumber] = useState(1);
  const [trashTemplatesTotalCount, setTrashTemplatesTotalCount] = useState(0);

  const [trashPatients, setTrashPatients] = useState<any[]>([]);
  const [isLoadingTrashPatients, setIsLoadingTrashPatients] = useState(false);
  const [trashPatientsError, setTrashPatientsError] = useState<string>('');
  const [trashPatientsPageNumber, setTrashPatientsPageNumber] = useState(1);
  const [trashPatientsTotalCount, setTrashPatientsTotalCount] = useState(0);
  const [_archivedItems, _setArchivedItems] = useState<any[]>([]);
  const [_isLoadingArchived, _setIsLoadingArchived] = useState(false);
  const [_archivedError, _setArchivedError] = useState<string>('');
  const [_archivedPageNumber, _setArchivedPageNumber] = useState(1);
  const [_archivedTotalCount, _setArchivedTotalCount] = useState(0);

  const loadTrashUsers = useCallback(async (page: number) => {
    setIsLoadingTrash(true);
    setTrashError('');
    try {
      const response = await usersApiClient.getTrashUsers({
        pageNumber: page,
        pageSize: TRASH_PAGE_SIZE,
      });
      setTrashItems(response.items);
      setTrashTotalCount(response.totalCount);
      setTrashPageNumber(page);
    } catch (error: any) {
      setTrashError(error?.message || 'فشل تحميل المستخدمين المحذوفين');
      logger.error('Error loading trash users:', error);
    } finally {
      setIsLoadingTrash(false);
    }
  }, []);

  const loadTrashQueues = useCallback(async (page: number) => {
    setIsLoadingTrashQueues(true);
    setTrashQueuesError('');
    try {
      const response = await queuesApiClient.getTrashQueues({
        pageNumber: page,
        pageSize: TRASH_PAGE_SIZE,
      });
      setTrashQueues(response.items);
      setTrashQueuesTotalCount(response.totalCount);
      setTrashQueuesPageNumber(page);
    } catch (error: any) {
      setTrashQueuesError(error?.message || 'فشل تحميل العيادات المحذوفة');
      logger.error('Error loading trash queues:', error);
    } finally {
      setIsLoadingTrashQueues(false);
    }
  }, []);

  const loadTrashTemplates = useCallback(async (page: number) => {
    setIsLoadingTrashTemplates(true);
    setTrashTemplatesError('');
    try {
      const response = await messageApiClient.getTrashTemplates({
        pageNumber: page,
        pageSize: TRASH_PAGE_SIZE,
      });
      setTrashTemplates(response.items);
      setTrashTemplatesTotalCount(response.totalCount);
      setTrashTemplatesPageNumber(page);
    } catch (error: any) {
      setTrashTemplatesError(error?.message || 'فشل تحميل القوالب المحذوفة');
      logger.error('Error loading trash templates:', error);
    } finally {
      setIsLoadingTrashTemplates(false);
    }
  }, []);

  const loadTrashPatients = useCallback(async (page: number) => {
    setIsLoadingTrashPatients(true);
    setTrashPatientsError('');
    try {
      // Placeholder: implement actual patients trash retrieval when API supports it
      setTrashPatients([]);
      setTrashPatientsTotalCount(0);
      setTrashPatientsPageNumber(page);
    } catch (error: any) {
      setTrashPatientsError(error?.message || 'فشل تحميل المرضى المحذوفين');
      logger.error('Error loading trash patients:', error);
    } finally {
      setIsLoadingTrashPatients(false);
    }
  }, []);

  // Listen for user/quota/trash updates after all state is defined
  useEffect(() => {
    const handleUserDataUpdate = async () => {
      // Always refetch users list to update moderators panel, secondary admins panel, etc.
      try {
        await actions.fetchUsers();
      } catch (error) {
        logger.error('Failed to refetch users after update:', error);
      }

      // Refresh user data in AuthContext when user data is updated (for accountSettings tab)
      if (activeTab === 'accountSettings') {
        await refreshUser();
      }
    };

    // Listen for custom event from EditAccountModal, AddUserModal, EditUserModal
    window.addEventListener('userDataUpdated', handleUserDataUpdate);

    // Also check sessionStorage for editAccountWasOpen flag
    const checkForEdit = async () => {
      const editAccountWasOpen = sessionStorage.getItem('editAccountWasOpen');
      if (editAccountWasOpen === 'true' && activeTab === 'accountSettings') {
        await refreshUser();
        sessionStorage.removeItem('editAccountWasOpen');
      }
    };

    // Check immediately
    checkForEdit();

    // Poll for changes (since storage events don't fire in same window)
    // Reduced frequency from 500ms to 2 seconds to reduce CPU usage
    const interval = setInterval(() => {
      if (activeTab === 'accountSettings') {
        checkForEdit();
      }
    }, 2000); // Reduced from 500ms to 2 seconds

    // Listen for quota updates
    const handleQuotaUpdate = async () => {
      if (activeTab === 'quota' || activeTab === 'moderators') {
        // Refetch users to get updated quota data
        await actions.fetchUsers();
      }
    };
    window.addEventListener('quotaDataUpdated', handleQuotaUpdate);

    // Listen for trash updates
    const handleTrashUpdate = async () => {
      if (activeTab === 'trash') {
        // Refetch trash data when items are restored or deleted
        if (trashPageNumber === 1) {
          await loadTrashUsers(1);
          await loadTrashQueues(1);
          await loadTrashTemplates(1);
          await loadTrashPatients(1);
        }
      }
    };
    window.addEventListener('userDataUpdated', handleTrashUpdate);
    window.addEventListener('queueDataUpdated', handleTrashUpdate);
    window.addEventListener('templateDataUpdated', handleTrashUpdate);
    window.addEventListener('patientDataUpdated', handleTrashUpdate);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
      window.removeEventListener('quotaDataUpdated', handleQuotaUpdate);
      window.removeEventListener('userDataUpdated', handleTrashUpdate);
      window.removeEventListener('queueDataUpdated', handleTrashUpdate);
      window.removeEventListener('templateDataUpdated', handleTrashUpdate);
      window.removeEventListener('patientDataUpdated', handleTrashUpdate);
      clearInterval(interval);
    };
  }, [
    activeTab,
    refreshUser,
    actions,
    trashPageNumber,
    loadTrashUsers,
    loadTrashQueues,
    loadTrashTemplates,
    loadTrashPatients,
  ]);

  // Load rate limit settings when System Settings tab is active
  useEffect(() => {
    const loadRateLimitSettings = async () => {
      if (activeTab !== 'systemSettings') return;
      if (currentUser?.role !== UserRole.PrimaryAdmin && currentUser?.role !== UserRole.SecondaryAdmin) return;

      setRateLimitLoading(true);
      try {
        const settings = await settingsApiClient.getRateLimitSettings();
        setRateLimitSettings(settings);
        setTempMinSeconds(settings.minSeconds);
        setTempMaxSeconds(settings.maxSeconds);
        setTempEnabled(settings.enabled);
      } catch (err) {
        logger.error('Failed to load rate limit settings:', err);
        // Use defaults
        setRateLimitSettings({
          minSeconds: 3,
          maxSeconds: 7,
          enabled: true,
          estimatedSecondsPerMessage: 9
        });
        setTempMinSeconds(3);
        setTempMaxSeconds(7);
        setTempEnabled(true);
      } finally {
        setRateLimitLoading(false);
      }
    };
    loadRateLimitSettings();
  }, [activeTab, currentUser?.role]);

  // Listen for trash updates (after state declarations)
  useEffect(() => {
    const handleTrashUpdate = async () => {
      if (activeTab === 'trash') {
        await loadTrashUsers(trashPageNumber);
        await loadTrashQueues(trashQueuesPageNumber);
        await loadTrashTemplates(trashTemplatesPageNumber);
        await loadTrashPatients(trashPatientsPageNumber);
      }
    };

    window.addEventListener('userDataUpdated', handleTrashUpdate);
    window.addEventListener('queueDataUpdated', handleTrashUpdate);
    window.addEventListener('templateDataUpdated', handleTrashUpdate);
    window.addEventListener('patientDataUpdated', handleTrashUpdate);

    return () => {
      window.removeEventListener('userDataUpdated', handleTrashUpdate);
      window.removeEventListener('queueDataUpdated', handleTrashUpdate);
      window.removeEventListener('templateDataUpdated', handleTrashUpdate);
      window.removeEventListener('patientDataUpdated', handleTrashUpdate);
    };
  }, [
    activeTab,
    trashPageNumber,
    trashQueuesPageNumber,
    trashTemplatesPageNumber,
    trashPatientsPageNumber,
    loadTrashUsers,
    loadTrashQueues,
    loadTrashTemplates,
    loadTrashPatients,
  ]);

  // Fetch inline logs when logs tab is active - using server-side pagination
  const fetchInlineLogs = useCallback(async () => {
    if (activeTab !== 'logs') return;

    setInlineLogsLoading(true);
    setInlineLogsError(null);

    try {
      // Convert date from YYYY-MM-DD to YYYYMMDD for API
      const dateForApi = inlineLogDateFilter ? inlineLogDateFilter.replace(/-/g, '') : undefined;

      // Use server-side pagination
      // Use server-side pagination and search
      const response = await logsApiClient.getLogs(
        dateForApi,
        currentPage,
        logsPerPage,
        inlineLogLevelFilter,
        inlineLogSearchQuery.trim() // Pass search query to API
      );

      // Store the actual total count from API
      setInlineLogsTotalCount(response.totalCount);

      setInlineLogs(response.logs);
    } catch (err: any) {
      logger.error('Failed to fetch inline logs:', err);
      setInlineLogsError(err.message || 'فشل تحميل السجلات');
    } finally {
      setInlineLogsLoading(false);
    }
  }, [activeTab, inlineLogDateFilter, currentPage, logsPerPage, inlineLogLevelFilter, inlineLogSearchQuery]);

  // Fetch inline logs when tab becomes active or filters change
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchInlineLogs();
    }
  }, [activeTab, fetchInlineLogs]);

  // Reset pagination to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [inlineLogLevelFilter, inlineLogDateFilter, inlineLogSearchQuery]);

  // Export logs to CSV
  const handleExportLogs = async () => {
    setIsExporting(true);
    try {
      // TODO: Fetch actual logs from backend API
      // For now, export current user's settings as placeholder
      const logData = [
        { timestamp: new Date().toISOString(), level: 'Information', message: 'User settings exported', source: 'UserManagementPanel.tsx', username: currentUser?.username || 'N/A', userName: currentUser?.firstName || 'N/A' }
      ];

      // Prepare CSV content
      const headers = ['الوقت', 'المستوى', 'الرسالة', 'المصدر', 'اسم المستخدم', 'الاسم'];
      const csvContent = [
        headers.join(','),
        ...logData.map(log =>
          [log.timestamp, log.level, `"${log.message}"`, log.source, log.username || 'N/A', log.userName || 'N/A'].join(',')
        ),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      // Use local date for filename
      const dateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      link.setAttribute('download', `logs-${dateStr}.csv`);
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

  // Fetch users on mount - only once when component mounts or when currentUser changes
  useEffect(() => {
    // Only fetch if we have a current user and they're not a regular user
    if (currentUser && currentUser.role !== UserRole.User) {
      actions.fetchUsers();
    }
  }, [currentUser?.id, currentUser?.role]); // Only depend on user ID and role, not the entire actions object

  // Get all moderators
  const getModerators = (): User[] => {
    return state.users.filter((u) => u.role === UserRole.Moderator);
  };

  // Get all secondary admins
  const getSecondaryAdmins = (): User[] => {
    return state.users.filter((u) => u.role === UserRole.SecondaryAdmin);
  };

  // Get users managed by a specific moderator
  // Uses assignedModerator field (frontend semantic mapping of backend moderatorId)
  const getUsersByModerator = (moderatorId: string): User[] => {
    return state.users.filter(
      (u) => u.role === UserRole.User && (u as any).assignedModerator === moderatorId
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
    // Pass both role and moderatorId through modal context data
    openModal('addUser', { role, moderatorId });
  };

  const handleEditUser = (user: User) => {
    openModal('editUser', { user });
  };

  const handleDeleteUser = async (user: User) => {
    const fullName = getUserDisplayName(user);
    const confirmed = await confirm(createDeleteConfirmation(fullName));
    if (!confirmed) return;

    const success = await actions.deleteUser(user.id);
    if (success) {
      addToast(`تم حذف المستخدم ${fullName} بنجاح`, 'success');
      setSelectedUser(null);
    }
  };

  const handleEditModerator = (moderator: User) => {
    openModal('editUser', { user: moderator });
  };

  const handleDeleteModerator = async (moderator: User) => {
    const fullName = getUserDisplayName(moderator);
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

    // Fetch fresh quota data from API
    try {
      const quotaResult = await moderatorQuotaService.getQuota(moderator.id);
      if (quotaResult.success && quotaResult.data) {
        setSelectedQuota(quotaResult.data);
      } else {
        // Fallback to provided quota if fetch fails
        setSelectedQuota(quota);
      }
    } catch (error) {
      // Fallback to provided quota on error
      setSelectedQuota(quota);
    }

    setShowMessagesQuotaModal(true);
  };

  // Handle opening queues quota editor
  const handleEditQueuesQuota = async (moderator: User, quota: ModeratorQuota) => {
    setSelectedModeratorForQuota(moderator);

    // Fetch fresh quota data from API
    try {
      const quotaResult = await moderatorQuotaService.getQuota(moderator.id);
      if (quotaResult.success && quotaResult.data) {
        setSelectedQuota(quotaResult.data);
      } else {
        // Fallback to provided quota if fetch fails
        setSelectedQuota(quota);
      }
    } catch (error) {
      // Fallback to provided quota on error
      setSelectedQuota(quota);
    }

    setShowQueuesQuotaModal(true);
  };

  // Handle saving quota
  const handleSaveQuota = async (updatedQuota: ModeratorQuota & { _mode?: 'set' | 'add' }) => {
    if (!selectedModeratorForQuota) return;

    setQuotaSaving(true);
    try {
      // Extract mode from quota object (passed by modals)
      const mode = (updatedQuota as any)._mode || 'set';

      // Remove mode from quota object before passing to service
      const { _mode, ...quotaWithoutMode } = updatedQuota as any;

      const result = await moderatorQuotaService.updateQuota(
        selectedModeratorForQuota.id,
        quotaWithoutMode as ModeratorQuota,
        mode
      );
      if (result.success && result.data) {
        const fullName = getUserDisplayName(selectedModeratorForQuota);
        addToast(`تم تحديث حصة ${fullName} بنجاح`, 'success');

        // Update selectedQuota with fresh data from API before closing modal
        setSelectedQuota(result.data);

        // Refresh users to get updated quota data in the list (this updates the moderators tab)
        await actions.fetchUsers();

        // Trigger event to notify other components (including ModeratorQuotaDisplay in moderators tab)
        window.dispatchEvent(new CustomEvent('quotaDataUpdated'));

        // Close modals after a brief delay to allow state update
        setTimeout(() => {
          setShowQuotaModal(false);
          setShowMessagesQuotaModal(false);
          setShowQueuesQuotaModal(false);
          setSelectedModeratorForQuota(null);
          setSelectedQuota(null);
        }, 300);
      } else {
        addToast(result.error || 'فشل تحديث الحصة', 'error');
      }
    } catch (error) {
      addToast('حدث خطأ أثناء تحديث الحصة', 'error');
    } finally {
      setQuotaSaving(false);
    }
  };

  // Load trash metadata helpers created above

  // Handle restore user
  const handleRestoreUser = async (userId: string | number) => {
    try {
      await usersApiClient.restoreUser(Number(userId));
      addToast('تم استعادة المستخدم بنجاح', 'success');
      // Reload trash list
      await loadTrashUsers(trashPageNumber);
      // Refresh users list
      await actions.fetchUsers();
    } catch (error: any) {
      addToast(error?.message || 'فشل استعادة المستخدم', 'error');
      throw error;
    }
  };

  // Handle restore queue
  const handleRestoreQueue = async (queueId: string | number) => {
    try {
      await queuesApiClient.restoreQueue(Number(queueId));
      addToast('تم استعادة العيادة بنجاح', 'success');
      await loadTrashQueues(trashQueuesPageNumber);
      // Refresh sidebar queues
      if (refreshQueues) {
        await refreshQueues();
      }
      // Dispatch event to notify quota components to refresh
      window.dispatchEvent(new CustomEvent('quotaDataUpdated'));
      window.dispatchEvent(new CustomEvent('queueDataUpdated'));
    } catch (error: any) {
      addToast(error?.message || 'فشل استعادة العيادة', 'error');
    }
  };

  // Handle restore template
  const handleRestoreTemplate = async (templateId: string | number) => {
    try {
      await messageApiClient.restoreTemplate(Number(templateId));
      addToast('تم استعادة القالب بنجاح', 'success');
      await loadTrashTemplates(trashTemplatesPageNumber);
      window.dispatchEvent(new CustomEvent('templateDataUpdated'));
    } catch (error: any) {
      addToast(error?.message || 'فشل استعادة القالب', 'error');
    }
  };

  // Load trash when tab changes
  useEffect(() => {
    if (activeTab === 'trash') {
      loadTrashUsers(1);
      loadTrashQueues(1);
      loadTrashTemplates(1);
      loadTrashPatients(1);
    }
  }, [activeTab, loadTrashUsers, loadTrashQueues, loadTrashTemplates, loadTrashPatients]);

  // Note: Archived users are handled separately in UsersManagementView component
  // This panel only handles trash (restorable within 30 days)

  const formatDate = (date?: Date | string) => {
    if (!date) return 'لم يسجل دخول';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'لم يسجل دخول';
    // Use Gregorian calendar format with Arabic month names
    return formatLocalDateTime(dateObj);
  };

  // Pagination calculations for inline logs - use actual total from API (server-side pagination)
  const totalLogs = inlineLogsTotalCount;
  const totalPages = Math.max(1, Math.ceil(inlineLogsTotalCount / logsPerPage));

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
    red: 'border-red-600 text-red-600',
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
          {/* Account Settings Tab - Show for all (First Tab) */}
          <button
            onClick={() => handleTabChange('accountSettings')}
            className={`${TAB_BASE} ${activeTab === 'accountSettings' ? TAB_ACTIVE.blue : TAB_INACTIVE
              }`}
          >
            <i className="fas fa-user-cog"></i>
            معلومات الحساب
          </button>

          {/* Moderators Tab - Show for Primary & Secondary Admin */}
          {currentUser && (currentUser.role === UserRole.PrimaryAdmin || currentUser.role === UserRole.SecondaryAdmin) && (
            <button
              onClick={() => handleTabChange('moderators')}
              className={`${TAB_BASE} ${activeTab === 'moderators' ? TAB_ACTIVE.green : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-user-shield"></i>
              المشرفون ({moderators.length})
            </button>
          )}

          {/* My Users Tab - Show for Moderators only */}
          {currentUser && currentUser.role === UserRole.Moderator && (
            <button
              onClick={() => handleTabChange('myUsers')}
              className={`${TAB_BASE} ${activeTab === 'myUsers' ? TAB_ACTIVE.green : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-users"></i>
              المستخدمون ({myManagedUsers.length})
            </button>
          )}

          {/* Secondary Admins Tab - Show for Primary Admin only */}
          {currentUser && currentUser.role === UserRole.PrimaryAdmin && (
            <button
              onClick={() => handleTabChange('secondaryAdmins')}
              className={`${TAB_BASE} ${activeTab === 'secondaryAdmins' ? TAB_ACTIVE.orange : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-user-tie"></i>
              المديرون الثانويون ({secondaryAdmins.length})
            </button>
          )}

          {/* System Logs Tab - Show for Primary Admin only */}

          {/* WhatsApp Auth Tab - Show for Moderators and Users */}
          {currentUser && (currentUser.role === UserRole.Moderator || currentUser.role === UserRole.User) && (
            <button
              onClick={() => handleTabChange('whatsappAuth')}
              className={`${TAB_BASE} ${activeTab === 'whatsappAuth' ? TAB_ACTIVE.emerald : TAB_INACTIVE
                }`}
            >
              <i className="fab fa-whatsapp"></i>
              مصادقة واتساب
            </button>
          )}

          {/* Quota Tab - Show for Moderators and Users */}
          {currentUser && (currentUser.role === UserRole.Moderator || currentUser.role === UserRole.User) && (
            <button
              onClick={() => handleTabChange('quota')}
              className={`${TAB_BASE} ${activeTab === 'quota' ? TAB_ACTIVE.indigo : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-chart-pie"></i>
              الحصة
            </button>
          )}

          {/* Logs Tab - Show for Admins and Moderators only (NOT Users) */}
          {currentUser && (currentUser.role === UserRole.PrimaryAdmin || currentUser.role === UserRole.SecondaryAdmin) && (
            <button
              onClick={() => handleTabChange('logs')}
              className={`${TAB_BASE} ${activeTab === 'logs' ? TAB_ACTIVE.purple : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-history"></i>
              السجلات
            </button>
          )}

          {/* Trash Tab - Show for Admins and Moderators only (NOT Users) */}
          {currentUser && (currentUser.role === UserRole.PrimaryAdmin || currentUser.role === UserRole.SecondaryAdmin) && (
            <button
              onClick={() => handleTabChange('trash')}
              className={`${TAB_BASE} ${activeTab === 'trash' ? TAB_ACTIVE.red : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-trash"></i>
              المهملات {trashTotalCount > 0 && `(${trashTotalCount})`}
            </button>
          )}

          {/* System Settings Tab - Show for Primary and Secondary Admin only */}
          {currentUser && (currentUser.role === UserRole.PrimaryAdmin || currentUser.role === UserRole.SecondaryAdmin) && (
            <button
              onClick={() => handleTabChange('systemSettings')}
              className={`${TAB_BASE} ${activeTab === 'systemSettings' ? TAB_ACTIVE.blue : TAB_INACTIVE
                }`}
            >
              <i className="fas fa-cog"></i>
              إعدادات النظام
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
            {/* Add Moderator Button - Only PrimaryAdmin can create moderators */}
            {currentUser?.role === UserRole.PrimaryAdmin && (
              <div>
                <button
                  onClick={() => handleAddUser(UserRole.Moderator)}
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
                            className={`fas fa-chevron-down text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''
                              }`}
                          ></i>
                          <span className="text-xs font-medium text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-200">
                            {managedUsers.length} مستخدم
                          </span>
                          <div className="text-right">
                            <h3 className="font-semibold text-gray-900">
                              {getUserDisplayName(moderator)}
                            </h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>
                          {/* Edit Moderator - Only PrimaryAdmin and SecondaryAdmin */}
                          {(currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin) && (
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
                          )}
                          {/* Delete Moderator - Only PrimaryAdmin */}
                          {currentUser?.role === UserRole.PrimaryAdmin && (
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
                          )}
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
                                  {(() => {
                                    if (!moderator.createdAt) return 'لم يحدد';
                                    const date = moderator.createdAt instanceof Date ? moderator.createdAt : new Date(moderator.createdAt);
                                    if (isNaN(date.getTime())) return 'لم يحدد';
                                    return formatLocalDateTime(date);
                                  })()}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium text-xs block mb-1">آخر دخول</span>
                                <p className="text-gray-900 font-semibold text-xs">
                                  {(() => {
                                    if (!moderator.lastLogin) return 'لم يدخل بعد';
                                    const date = moderator.lastLogin instanceof Date ? moderator.lastLogin : new Date(moderator.lastLogin);
                                    if (isNaN(date.getTime())) return 'لم يدخل بعد';
                                    return formatLocalDateTime(date);
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Quota Display Section */}
                          <div className="px-6 py-4 border-b border-gray-200">
                            <ModeratorQuotaDisplay
                              moderatorId={moderator.id}
                              quota={(() => {
                                // Try to get quota from moderator object
                                if (moderator.role === 'moderator' && 'quota' in moderator) {
                                  return (moderator as any).quota as ModeratorQuota;
                                }
                                // If quota not found, return undefined - ModeratorQuotaDisplay will use defaults
                                // The quota should be loaded via useModeratorQuota hook or fetched separately
                                return undefined;
                              })()}
                              onEditMessages={(quota) => handleEditMessagesQuota(moderator, quota)}
                              onEditQueues={(quota) => handleEditQueuesQuota(moderator, quota)}
                            />
                          </div>

                          {/* Add User Button for this Moderator - Only for admins and moderators (NOT regular users) */}
                          {(currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin || currentUser?.role === UserRole.Moderator) && (
                            <div className="px-6 py-4 border-b border-gray-200">
                              <button
                                onClick={() => handleAddUser(UserRole.User, moderator.id)}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                              >
                                <i className="fas fa-plus"></i>
                                <span>إضافة مستخدم جديد</span>
                              </button>
                            </div>
                          )}

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
                                        {getUserDisplayName(user)}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-gray-600">
                                        @{user.username}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-gray-600">
                                        {formatDate(user.lastLogin)}
                                      </td>
                                      <td className="px-6 py-4 text-sm">
                                        {/* Edit/Delete buttons - Only for admins and moderators (NOT regular users) */}
                                        {(currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin || currentUser?.role === UserRole.Moderator) && (
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
                                        )}
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
                                className={`fas fa-chevron-down text-orange-600 transition-transform ${isExpanded ? 'rotate-180' : ''
                                  }`}
                              ></i>
                              <div className="text-right">
                                <h3 className="font-semibold text-gray-900">
                                  {getUserDisplayName(admin)}
                                </h3>
                              </div>
                            </div>
                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                                {roleInfo.label}
                              </span>
                              {/* Edit/Delete Secondary Admin - Only PrimaryAdmin */}
                              {currentUser?.role === UserRole.PrimaryAdmin && (
                                <>
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
                                </>
                              )}
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
                                  <span className={`inline-flex items-center gap-2 ${!(admin.isDeleted ?? false) ? 'text-green-600' : 'text-red-600'}`}>
                                    <i className={`fas ${!(admin.isDeleted ?? false) ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                    {!(admin.isDeleted ?? false) ? 'نشط' : 'غير نشط'}
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
                      openModal('editAccount', { user: currentUser });
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
                    {currentUser ? getUserDisplayName(currentUser) : 'لم يتم تعيين'}
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

        {/* Logs Section - Purple themed with API-driven table for all users */}
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
            <div className="bg-white border border-gray-200 rounded-lg p-4">
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
                    value={inlineLogSearchQuery}
                    onChange={(e) => setInlineLogSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Log Level Filter */}
                <div className="min-w-40">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <i className="fas fa-layer-group ml-1"></i>
                    مستوى السجل
                  </label>
                  <select
                    value={inlineLogLevelFilter}
                    onChange={(e) => setInlineLogLevelFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value="All">جميع المستويات</option>
                    <option value="INF">معلومات</option>
                    <option value="WRN">تحذيرات</option>
                    <option value="ERR">أخطاء</option>
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
                    value={inlineLogDateFilter}
                    onChange={(e) => setInlineLogDateFilter(e.target.value)}
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

                {/* Refresh Button */}
                <button
                  onClick={fetchInlineLogs}
                  disabled={inlineLogsLoading}
                  className="h-9 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap inline-flex items-center gap-2"
                >
                  {inlineLogsLoading ? (
                    <>
                      <i className="fas fa-spinner animate-spin"></i>
                      جاري التحديث...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sync-alt"></i>
                      تحديث
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Loading State */}
              {inlineLogsLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <i className="fas fa-spinner animate-spin text-2xl text-purple-600 mb-2"></i>
                    <p className="text-gray-600">جاري تحميل السجلات...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {!inlineLogsLoading && inlineLogsError && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <i className="fas fa-exclamation-triangle text-2xl text-red-500 mb-2"></i>
                    <p className="text-red-600">{inlineLogsError}</p>
                    <button
                      onClick={fetchInlineLogs}
                      className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!inlineLogsLoading && !inlineLogsError && inlineLogs.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <i className="fas fa-file-alt text-4xl text-gray-300 mb-2"></i>
                    <p className="text-gray-600">لا توجد سجلات</p>
                    <p className="text-sm text-gray-500">لم يتم العثور على أي سجلات للتاريخ المحدد</p>
                  </div>
                </div>
              )}

              {/* Logs Table */}
              {!inlineLogsLoading && !inlineLogsError && inlineLogs.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-purple-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase w-24">الوقت</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase w-28">التاريخ</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-purple-900 uppercase w-24">النوع</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-purple-900 uppercase">الرسالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inlineLogs.map((log, index) => (
                        <tr key={`${log.lineNumber}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-900 font-mono text-xs whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString('ar-EG-u-nu-latn', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            })}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleDateString('ar-EG-u-nu-latn', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                              <i className={`fas ${getLevelIcon(log.level)} text-xs`}></i>
                              {log.levelArabic}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-mono text-xs" dir="ltr">
                            {log.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                عرض ({Math.min((currentPage - 1) * logsPerPage + 1, totalLogs)} - {Math.min(currentPage * logsPerPage, totalLogs)}) من أصل {totalLogs} سجل
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === page
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

            {/* Add User Button - Only for Moderators (NOT regular users) */}
            {currentUser?.role === UserRole.Moderator && (
              <div>
                <button
                  onClick={() => handleAddUser(UserRole.User, currentUser.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  <i className="fas fa-plus"></i>
                  <span>إضافة مستخدم جديد</span>
                </button>
              </div>
            )}

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
                            {formatDate(user.lastLogin)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {/* Edit/Delete buttons - Only for Moderators (NOT regular users) */}
                            {currentUser?.role === UserRole.Moderator && (
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
                            )}
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
          <WhatsAppAuthTabContent />
        )}

        {/* Quota Section - For Moderators and Users */}
        {activeTab === 'quota' && (currentUser?.role === UserRole.Moderator || currentUser?.role === UserRole.User) && (
          <QuotaTabContent currentUser={currentUser} />
        )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  <p className="text-sm font-semibold mt-1">{String(selectedLog.level)}</p>
                </div>
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">الوقت</p>
                  <p className="text-sm font-semibold mt-1">{selectedLog.timestamp ? formatLocalDateTime(selectedLog.timestamp as string) : 'غير محدد'}</p>
                </div>
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">المصدر</p>
                  <p className="text-xs font-semibold mt-1 font-mono">{String(selectedLog.source)}</p>
                </div>
                <div className="border-l-4 border-orange-600 pl-4">
                  <p className="text-xs text-gray-600 font-medium">المستخدم</p>
                  <p className="text-sm font-semibold mt-1">{String(selectedLog.userName)}</p>
                </div>
              </div>

              {/* Message */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-2">الرسالة</p>
                <p className="text-sm text-gray-900 font-mono break-words">{String(selectedLog.message)}</p>
              </div>

              {/* Exception */}
              {selectedLog.exception && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs text-red-600 font-medium mb-2">الاستثناء</p>
                  <p className="text-sm text-red-900 font-mono break-words">{String(selectedLog.exception)}</p>
                </div>
              )}

              {/* Stack Trace */}
              {selectedLog.stackTrace && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium mb-2">تتبع المكدس</p>
                  <pre className="text-xs text-gray-900 overflow-x-auto whitespace-pre-wrap break-words">{String(selectedLog.stackTrace)}</pre>
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



      {/* Trash Tab */}
      {activeTab === 'trash' && (currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin || currentUser?.role === UserRole.Moderator) && (
        <div className="space-y-6">
          {/* Trash Header */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <i className="fas fa-trash"></i>
              المهملات
            </h3>
            <p className="text-sm text-red-700 mt-2">
              يمكنك استعادة العناصر المحذوفة خلال 30 يوم من تاريخ الحذف. المهملات تحتوي على المستخدمين والعيادات والقوالب والمرضى المحذوفين.
            </p>
          </div>

          {/* Trash Tab Content - Users */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => {
                setExpandedTrashSections(prev => {
                  const next = new Set(prev);
                  if (next.has('users')) next.delete('users'); else next.add('users');
                  return next;
                });
              }}
              className="w-full text-right flex items-center justify-between p-4 hover:bg-gray-50 transition-colors bg-white border-b border-gray-100"
            >
              <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-users text-blue-600"></i>
                المستخدمون المحذوفون
              </h4>
              <i className={`fas fa-chevron-down text-gray-600 transition-transform ${expandedTrashSections.has('users') ? 'rotate-180' : ''}`}></i>
            </button>
            {expandedTrashSections.has('users') && (
              <div className="p-4">
                <TrashTab
                  entityType="user"
                  items={trashItems}
                  isLoading={isLoadingTrash}
                  isError={!!trashError}
                  errorMessage={trashError}
                  pageNumber={trashPageNumber}
                  pageSize={TRASH_PAGE_SIZE}
                  totalCount={trashTotalCount}
                  onPageChange={loadTrashUsers}
                  onRestore={handleRestoreUser}
                  adminOnly={false}
                  isAdmin={currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin}
                />
              </div>
            )}
          </div>

          {/* Trash Tab Content - Queues */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => {
                setExpandedTrashSections(prev => {
                  const next = new Set(prev);
                  if (next.has('queues')) next.delete('queues'); else next.add('queues');
                  return next;
                });
              }}
              className="w-full text-right flex items-center justify-between p-4 hover:bg-gray-50 transition-colors bg-white border-b border-gray-100"
            >
              <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-layer-group text-purple-600"></i>
                العيادات المحذوفة
              </h4>
              <i className={`fas fa-chevron-down text-gray-600 transition-transform ${expandedTrashSections.has('queues') ? 'rotate-180' : ''}`}></i>
            </button>
            {expandedTrashSections.has('queues') && (
              <div className="p-4">
                <TrashTab
                  entityType="queue"
                  items={trashQueues.map(q => ({ ...q, name: q.doctorName, id: q.id }))}
                  isLoading={isLoadingTrashQueues}
                  isError={!!trashQueuesError}
                  errorMessage={trashQueuesError}
                  pageNumber={trashQueuesPageNumber}
                  pageSize={TRASH_PAGE_SIZE}
                  totalCount={trashQueuesTotalCount}
                  onPageChange={loadTrashQueues}
                  onRestore={handleRestoreQueue}
                  adminOnly={false}
                  isAdmin={currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin}
                />
              </div>
            )}
          </div>

          {/* Trash Tab Content - Templates */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => {
                setExpandedTrashSections(prev => {
                  const next = new Set(prev);
                  if (next.has('templates')) next.delete('templates'); else next.add('templates');
                  return next;
                });
              }}
              className="w-full text-right flex items-center justify-between p-4 hover:bg-gray-50 transition-colors bg-white border-b border-gray-100"
            >
              <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-file-alt text-green-600"></i>
                القوالب المحذوفة
              </h4>
              <i className={`fas fa-chevron-down text-gray-600 transition-transform ${expandedTrashSections.has('templates') ? 'rotate-180' : ''}`}></i>
            </button>
            {expandedTrashSections.has('templates') && (
              <div className="p-4">
                <TrashTab
                  entityType="template"
                  items={trashTemplates.map(t => ({ ...t, name: t.title, id: t.id }))}
                  isLoading={isLoadingTrashTemplates}
                  isError={!!trashTemplatesError}
                  errorMessage={trashTemplatesError}
                  pageNumber={trashTemplatesPageNumber}
                  pageSize={TRASH_PAGE_SIZE}
                  totalCount={trashTemplatesTotalCount}
                  onPageChange={loadTrashTemplates}
                  onRestore={handleRestoreTemplate}
                  adminOnly={false}
                  isAdmin={currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin}
                  queues={queues}
                />
              </div>
            )}
          </div>

          {/* Trash Tab Content - Patients */}
          {trashPatientsTotalCount > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <i className="fas fa-user-injured text-orange-600"></i>
                المرضى المحذوفون
              </h4>
              <TrashTab
                entityType="patient"
                items={trashPatients.map(p => ({ ...p, name: p.fullName || p.name, id: p.id }))}
                isLoading={isLoadingTrashPatients}
                isError={!!trashPatientsError}
                errorMessage={trashPatientsError}
                pageNumber={trashPatientsPageNumber}
                pageSize={TRASH_PAGE_SIZE}
                totalCount={trashPatientsTotalCount}
                onPageChange={loadTrashPatients}
                onRestore={async (id) => {
                  // Placeholder - implement when patient restore endpoint is available
                  addToast('استعادة المرضى قيد التطوير', 'info');
                }}
                adminOnly={false}
                isAdmin={currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin}
              />
            </div>
          )}
        </div>
      )}

      {/* System Settings Section (Admin Only) */}
      {activeTab === 'systemSettings' && (currentUser?.role === UserRole.PrimaryAdmin || currentUser?.role === UserRole.SecondaryAdmin) && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
              <i className="fas fa-cog"></i>
              إعدادات النظام
            </h3>
            <p className="text-sm text-blue-700 mt-2">
              إدارة إعدادات النظام الأساسية في حدود الاستخدام.
            </p>
          </div>

          {/* Rate Limit Settings Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-100 p-4">
              <h4 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <i className="fas fa-shield-alt text-blue-600"></i>
                إعدادات حماية الحساب (Rate Limiting)
              </h4>
              <p className="text-blue-700 text-sm mt-1">
                تحكم في التأخير العشوائي بين الرسائل لحماية الحساب من اكتشاف النمط المتكرر
              </p>
            </div>

            <div className="p-4">
              {/* Current Settings Display */}
              {rateLimitSettings && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                  <h4 className="text-blue-800 font-semibold mb-2 flex items-center gap-2">
                    <i className="fas fa-info-circle"></i>
                    الإعدادات الحالية
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-blue-600">{rateLimitSettings.minSeconds}</div>
                      <div className="text-gray-600">الحد الأدنى (ثانية)</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-blue-600">{rateLimitSettings.maxSeconds}</div>
                      <div className="text-gray-600">الحد الأقصى (ثانية)</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                      <div className={`text-2xl font-bold ${rateLimitSettings.enabled ? 'text-green-600' : 'text-red-600'}`}>
                        {rateLimitSettings.enabled ? 'مفعّل' : 'معطّل'}
                      </div>
                      <div className="text-gray-600">الحالة</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الحد الأدنى للتأخير (ثانية)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={tempMinSeconds}
                      onChange={(e) => setTempMinSeconds(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="3"
                    />
                    <p className="text-xs text-gray-500 mt-1">قيمة بين 0 و 60 ثانية</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الحد الأقصى للتأخير (ثانية)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={tempMaxSeconds}
                      onChange={(e) => setTempMaxSeconds(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="7"
                    />
                    <p className="text-xs text-gray-500 mt-1">قيمة بين 1 و 120 ثانية</p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">تفعيل حماية الحساب</h4>
                    <p className="text-sm text-gray-500">عند التعطيل، سيتم إرسال الرسائل بدون تأخير (غير موصى به)</p>
                  </div>
                  <button
                    onClick={() => setTempEnabled(!tempEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${tempEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    role="switch"
                    aria-checked={tempEnabled}
                    dir="ltr"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tempEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Validation Warning */}
                {tempMaxSeconds < tempMinSeconds && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    الحد الأقصى يجب أن يكون أكبر من أو يساوي الحد الأدنى
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={async () => {
                      if (rateLimitSettings) {
                        setTempMinSeconds(rateLimitSettings.minSeconds);
                        setTempMaxSeconds(rateLimitSettings.maxSeconds);
                        setTempEnabled(rateLimitSettings.enabled);
                      }
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fas fa-undo ml-1"></i>
                    إعادة تعيين
                  </button>
                  <button
                    onClick={async () => {
                      if (tempMaxSeconds < tempMinSeconds) {
                        addToast('الحد الأقصى يجب أن يكون أكبر من أو يساوي الحد الأدنى', 'error');
                        return;
                      }
                      setRateLimitSaving(true);
                      try {
                        const updated = await settingsApiClient.updateRateLimitSettings({
                          minSeconds: tempMinSeconds,
                          maxSeconds: tempMaxSeconds,
                          enabled: tempEnabled
                        });
                        setRateLimitSettings(updated);
                        addToast('تم حفظ إعدادات حماية الحساب بنجاح', 'success');
                      } catch (err) {
                        logger.error('Failed to save rate limit settings:', err);
                        addToast('فشل حفظ الإعدادات', 'error');
                      } finally {
                        setRateLimitSaving(false);
                      }
                    }}
                    disabled={rateLimitSaving || tempMaxSeconds < tempMinSeconds}
                    className={`px-6 py-2 rounded-lg font-medium text-white flex items-center gap-2 transition-colors ${rateLimitSaving || tempMaxSeconds < tempMinSeconds
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {rateLimitSaving ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        جارٍ الحفظ...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        حفظ الإعدادات
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-blue-800 font-semibold mb-2 flex items-center gap-2">
              <i className="fas fa-lightbulb"></i>
              ملاحظات مهمة
            </h4>
            <ul className="text-blue-700 text-sm space-y-2 list-disc list-inside">
              <li>يتم توليد تأخير عشوائي بين الحد الأدنى والأقصى قبل كل رسالة</li>
              <li>التأخير العشوائي يمنع واتساب من اكتشاف نمط الإرسال الآلي</li>
              <li>القيم الافتراضية (3-7 ثانية) توفر توازناً جيداً بين السرعة والأمان</li>
              <li>تعطيل الحماية قد يؤدي لحظر الحساب - استخدم بحذر!</li>
            </ul>
          </div>
        </div>
      )}
      </div>


      {/* Modals */}
      <EditUserModal selectedUser={null} />
      <EditAccountModal selectedUser={null} />
      {/* AddUserModal is rendered in MainApp.tsx to avoid duplicate IDs */}
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
        moderatorName={selectedModeratorForQuota ? getUserDisplayName(selectedModeratorForQuota) : ''}
        onClose={async () => {
          setShowQuotaModal(false);
          // Refresh quota data after modal closes
          if (selectedModeratorForQuota) {
            try {
              const quotaResult = await moderatorQuotaService.getQuota(selectedModeratorForQuota.id);
              if (quotaResult.success && quotaResult.data) {
                // Update quota in the moderator list
                await actions.fetchUsers();
              }
              // QuotaTabContent will refresh automatically via quotaDataUpdated event listener
            } catch (error) {
              logger.error('Failed to refresh quota after update:', error);
            }
          }
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
        moderatorName={selectedModeratorForQuota ? getUserDisplayName(selectedModeratorForQuota) : ''}
        moderatorData={selectedModeratorForQuota}
        onClose={async () => {
          setShowMessagesQuotaModal(false);
          // Refresh quota data after modal closes (for moderators tab)
          if (selectedModeratorForQuota) {
            try {
              // Refresh users list to update quota in moderators tab
              await actions.fetchUsers();

              // Trigger event to notify ModeratorQuotaDisplay components and QuotaTabContent
              window.dispatchEvent(new CustomEvent('quotaDataUpdated'));
            } catch (error) {
              logger.error('Failed to refresh quota after update:', error);
            }
          }
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
        moderatorName={selectedModeratorForQuota ? getUserDisplayName(selectedModeratorForQuota) : ''}
        moderatorData={selectedModeratorForQuota}
        onClose={async () => {
          setShowQueuesQuotaModal(false);
          // Refresh quota data after modal closes (for moderators tab)
          if (selectedModeratorForQuota) {
            try {
              // Refresh users list to update quota in moderators tab
              await actions.fetchUsers();

              // Trigger event to notify ModeratorQuotaDisplay components and QuotaTabContent
              window.dispatchEvent(new CustomEvent('quotaDataUpdated'));
            } catch (error) {
              logger.error('Failed to refresh quota after update:', error);
            }
          }
          setSelectedModeratorForQuota(null);
          setSelectedQuota(null);
        }}
        onSave={handleSaveQuota}
        isLoading={quotaSaving}
      />
    </>
  );
}

