'use client';

import { PanelWrapper } from '../Common/PanelWrapper';
import { PanelHeader } from '../Common/PanelHeader';
import UserManagementPanel from './UserManagementPanel';
import { useUserManagement } from '@/hooks/useUserManagement';
import { UserRole } from '@/types/roles';
import { useEffect } from 'react';

export default function ManagementPanel() {
  const [state, actions] = useUserManagement();

  useEffect(() => {
    actions.fetchUsers();
  }, []);

  // Calculate stats
  const moderatorCount = state.users.filter((u) => u.role === UserRole.Moderator).length;
  const secondaryAdminCount = state.users.filter((u) => u.role === UserRole.SecondaryAdmin).length;
  const regularUserCount = state.users.filter((u) => u.role === UserRole.User).length;
  const totalUsers = state.users.length;

  return (
    <PanelWrapper>
      <PanelHeader
        title="إدارة المستخدمين"
        icon="fa-users"
        description="إدارة المديرين والمشرفين والمستخدمين"
        stats={[
          {
            label: 'إجمالي المستخدمين',
            value: totalUsers,
            icon: 'fa-users',
            color: 'blue',
          },
          {
            label: 'المديرون الثانويون',
            value: secondaryAdminCount,
            icon: 'fa-user-tie',
            color: 'yellow',
          },
          {
            label: 'المشرفون',
            value: moderatorCount,
            icon: 'fa-user-shield',
            color: 'green',
          },
          {
            label: 'المستخدمون العاديون',
            value: regularUserCount,
            icon: 'fa-user',
            color: 'purple',
          },
        ]}
      />
      <UserManagementPanel />
    </PanelWrapper>
  );
}
