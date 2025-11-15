/**
 * Users Management Page with Trash Integration
 * File: apps/web/components/Moderators/UsersManagementView.tsx
 * 
 * Integrates the TrashTab component for soft-deleted user management
 * Admin only view
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { usersApiClient } from '@/services/api/usersApiClient';
import { useUI } from '@/contexts/UIContext';
import TrashTab from '@/components/TrashTab';
import { TabNavigation } from '@/components/Common/TabNavigation';
import logger from '@/utils/logger';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

export default function UsersManagementView() {
  const { addToast } = useUI();
  const [activeTab, setActiveTab] = useState<string>('active');
  
  // Trash tab state
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashError, setTrashError] = useState<string>('');
  const [trashPageNumber, setTrashPageNumber] = useState(1);
  const [trashTotalCount, setTrashTotalCount] = useState(0);
  const pageSize = 10;

  // Archived tab state (admin only)
  const [archivedItems, setArchivedItems] = useState<any[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [archivedError, setArchivedError] = useState<string>('');
  const [archivedPageNumber, setArchivedPageNumber] = useState(1);
  const [archivedTotalCount, setArchivedTotalCount] = useState(0);

  // Load trash users
  const loadTrashUsers = useCallback(async (page: number) => {
    setIsLoadingTrash(true);
    setTrashError('');
    try {
      const response = await usersApiClient.getTrashUsers({
        pageNumber: page,
        pageSize,
      });
      setTrashItems(response.items);
      setTrashTotalCount(response.totalCount);
      setTrashPageNumber(page);
    } catch (error: any) {
      setTrashError(error?.message || 'Failed to load trash users');
      logger.error('Error loading trash users:', error);
    } finally {
      setIsLoadingTrash(false);
    }
  }, []);

  // Load archived users
  const loadArchivedUsers = useCallback(async (page: number) => {
    setIsLoadingArchived(true);
    setArchivedError('');
    try {
      const response = await usersApiClient.getArchivedUsers({
        pageNumber: page,
        pageSize,
      });
      setArchivedItems(response.items);
      setArchivedTotalCount(response.totalCount);
      setArchivedPageNumber(page);
    } catch (error: any) {
      setArchivedError(error?.message || 'Failed to load archived users');
      logger.error('Error loading archived users:', error);
    } finally {
      setIsLoadingArchived(false);
    }
  }, []);

  // Load trash on tab change
  useEffect(() => {
    if (activeTab === 'trash') {
      loadTrashUsers(1);
    }
  }, [activeTab, loadTrashUsers]);

  // Load archived on tab change
  useEffect(() => {
    if (activeTab === 'archived') {
      loadArchivedUsers(1);
    }
  }, [activeTab, loadArchivedUsers]);

  // Handle restore
  const handleRestore = useCallback(
    async (userId: string | number) => {
      try {
        await usersApiClient.restoreUser(Number(userId));
        addToast('User restored successfully', 'success');
        // Reload trash list
        loadTrashUsers(trashPageNumber);
      } catch (error: any) {
        addToast(error?.message || 'Failed to restore user', 'error');
        throw error;
      }
    },
    [trashPageNumber, loadTrashUsers, addToast]
  );

  const tabs: Tab[] = [
    { id: 'active', label: 'Active Users', icon: 'fa-users' },
    { 
      id: 'trash', 
      label: 'Trash', 
      icon: 'fa-trash',
      badge: trashTotalCount > 0 ? trashTotalCount : undefined,
    },
    { 
      id: 'archived', 
      label: 'Archived', 
      icon: 'fa-archive',
      badge: archivedTotalCount > 0 ? archivedTotalCount : undefined,
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'active' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Users</h2>
            <p className="text-gray-600">Active users will appear here.</p>
            {/* TODO: Add active users list */}
          </div>
        )}

        {activeTab === 'trash' && (
          <TrashTab
            entityType="user"
            items={trashItems}
            isLoading={isLoadingTrash}
            isError={!!trashError}
            errorMessage={trashError}
            pageNumber={trashPageNumber}
            pageSize={pageSize}
            totalCount={trashTotalCount}
            onPageChange={loadTrashUsers}
            onRestore={handleRestore}
            adminOnly={false}
            isAdmin={true} // TODO: Get from auth context
          />
        )}

        {activeTab === 'archived' && (
          <TrashTab
            entityType="user"
            items={archivedItems}
            isLoading={isLoadingArchived}
            isError={!!archivedError}
            errorMessage={archivedError}
            pageNumber={archivedPageNumber}
            pageSize={pageSize}
            totalCount={archivedTotalCount}
            onPageChange={loadArchivedUsers}
            onRestore={async () => {}} // No restore for archived
            adminOnly={true}
            isAdmin={true} // TODO: Get from auth context
          />
        )}
      </div>
    </div>
  );
}
