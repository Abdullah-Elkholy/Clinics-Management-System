'use client';

import { PanelWrapper } from '../Common/PanelWrapper';
import { PanelHeader } from '../Common/PanelHeader';
import UserManagementPanel from './UserManagementPanel';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/roles';
import { useEffect, useMemo } from 'react';
import type { User } from '@/types/user';

export default function ManagementPanel() {
  const { user: currentUser } = useAuth();
  const [state, actions] = useUserManagement();

  useEffect(() => {
    actions.fetchUsers();
  }, []);

  // Refetch users when data is updated
  useEffect(() => {
    const handleUserDataUpdate = async () => {
      await actions.fetchUsers();
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
    };
  }, [actions]);

  // Memoize stats calculations to prevent unnecessary re-renders
  const stats = useMemo(() => {
    const moderators = state.users.filter((u) => u.role === UserRole.Moderator);
    const secondaryAdmins = state.users.filter((u) => u.role === UserRole.SecondaryAdmin);
    const regularUsers = state.users.filter((u) => u.role === UserRole.User);

    return {
      moderators,
      secondaryAdmins,
      regularUsers,
    };
  }, [state.users]);

  // Get users managed by a specific moderator
  const getUsersByModerator = (moderatorId: string): User[] => {
    return state.users.filter(
      (u) => u.role === UserRole.User && u.assignedModerator === moderatorId
    );
  };

  // Get current user's managed users
  const myManagedUsers = useMemo(() => {
    return currentUser?.role === UserRole.Moderator
      ? getUsersByModerator(currentUser.id)
      : [];
  }, [currentUser?.id, currentUser?.role, state.users]);

  // Get panel header props based on role
  const getPanelHeaderProps = () => {
    if (!currentUser) return { title: 'إدارة المستخدمين', stats: [] };

    switch (currentUser.role) {
      case UserRole.PrimaryAdmin:
        return {
          title: 'إدارة المستخدمين',
          description: 'إدارة حسابك والمديرين والمشرفين والمستخدمين',
          icon: 'fa-users-cog',
          stats: [
            { label: 'إجمالي المستخدمين', value: state.users.length, color: 'blue' as const, icon: 'fa-users' },
            { label: 'المديرون الثانويون', value: stats.secondaryAdmins.length, color: 'yellow' as const, icon: 'fa-user-tie' },
            { label: 'المشرفون', value: stats.moderators.length, color: 'green' as const, icon: 'fa-user-shield' },
            { label: 'المستخدمون العاديون', value: stats.regularUsers.length, color: 'purple' as const, icon: 'fa-user' },
          ],
        };

      case UserRole.SecondaryAdmin:
        return {
          title: 'إدارة المستخدمين',
          description: 'إدارة حسابك والمشرفين والمستخدمين الخاصين بهم',
          icon: 'fa-users-cog',
          stats: [
            { label: 'إجمالي المستخدمين', value: state.users.length, color: 'blue' as const, icon: 'fa-users' },
            { label: 'المشرفون', value: stats.moderators.length, color: 'green' as const, icon: 'fa-user-shield' },
            { label: 'المستخدمون العاديون', value: stats.regularUsers.length, color: 'purple' as const, icon: 'fa-user' },
          ],
        };

      case UserRole.Moderator:
        return {
          title: 'إدارة الحساب والمستخدمين',
          description: 'إدارة حسابك والمستخدمين الخاصين بك',
          icon: 'fa-users',
          stats: [
            { label: 'إجمالي المستخدمين الخاصين بك', value: myManagedUsers.length, color: 'green' as const, icon: 'fa-users' },
            { label: 'المستخدمون النشطون', value: myManagedUsers.filter(u => u.isActive).length, color: 'blue' as const, icon: 'fa-user-check' },
          ],
        };

      case UserRole.User:
        return {
          title: 'إدارة الحساب',
          description: 'إدارة إعدادات حسابك والاطلاع على معلومات الحصة ومصادقة الواتساب.',
          icon: 'fa-user-circle',
          stats: [],
        };

      default:
        return { title: 'إدارة المستخدمين', stats: [] };
    }
  };

  return (
    <PanelWrapper>
      <PanelHeader {...getPanelHeaderProps()} />
      <UserManagementPanel />
    </PanelWrapper>
  );
}
