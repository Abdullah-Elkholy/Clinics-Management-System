/**
 * Queues Management Page with Trash Integration
 * File: apps/web/components/Queue/QueuesManagementView.tsx
 * 
 * Integrates the TrashTab component for soft-deleted queue management
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { queuesApiClient } from '@/services/api/queuesApiClient';
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

export default function QueuesManagementView() {
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

  // Load trash queues
  const loadTrashQueues = useCallback(async (page: number) => {
    setIsLoadingTrash(true);
    setTrashError('');
    try {
      const response = await queuesApiClient.getTrashQueues({
        pageNumber: page,
        pageSize,
      });
      setTrashItems(response.items);
      setTrashTotalCount(response.totalCount);
      setTrashPageNumber(page);
    } catch (error: any) {
      setTrashError(error?.message || 'Failed to load trash queues');
      logger.error('Error loading trash queues:', error);
    } finally {
      setIsLoadingTrash(false);
    }
  }, []);

  // Load archived queues
  const loadArchivedQueues = useCallback(async (page: number) => {
    setIsLoadingArchived(true);
    setArchivedError('');
    try {
      const response = await queuesApiClient.getArchivedQueues({
        pageNumber: page,
        pageSize,
      });
      setArchivedItems(response.items);
      setArchivedTotalCount(response.totalCount);
      setArchivedPageNumber(page);
    } catch (error: any) {
      setArchivedError(error?.message || 'Failed to load archived queues');
      logger.error('Error loading archived queues:', error);
    } finally {
      setIsLoadingArchived(false);
    }
  }, []);

  // Load trash on tab change
  useEffect(() => {
    if (activeTab === 'trash') {
      loadTrashQueues(1);
    }
  }, [activeTab, loadTrashQueues]);

  // Load archived on tab change
  useEffect(() => {
    if (activeTab === 'archived') {
      loadArchivedQueues(1);
    }
  }, [activeTab, loadArchivedQueues]);

  // Handle restore
  const handleRestore = useCallback(
    async (queueId: string | number) => {
      try {
        await queuesApiClient.restoreQueue(Number(queueId));
        addToast('Queue restored successfully', 'success');
        // Reload trash list
        loadTrashQueues(trashPageNumber);
      } catch (error: any) {
        addToast(error?.message || 'Failed to restore queue', 'error');
        throw error;
      }
    },
    [trashPageNumber, loadTrashQueues, addToast]
  );

  const tabs: Tab[] = [
    { id: 'active', label: 'Active Queues', icon: 'fa-hospital' },
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
            <h2 className="text-xl font-semibold mb-4">Active Queues</h2>
            <p className="text-gray-600">Active queues will appear here.</p>
            {/* TODO: Add active queues list */}
          </div>
        )}

        {activeTab === 'trash' && (
          <TrashTab
            entityType="queue"
            items={trashItems}
            isLoading={isLoadingTrash}
            isError={!!trashError}
            errorMessage={trashError}
            pageNumber={trashPageNumber}
            pageSize={pageSize}
            totalCount={trashTotalCount}
            onPageChange={loadTrashQueues}
            onRestore={handleRestore}
            adminOnly={false}
            isAdmin={true} // TODO: Get from auth context
          />
        )}

        {activeTab === 'archived' && (
          <TrashTab
            entityType="queue"
            items={archivedItems}
            isLoading={isLoadingArchived}
            isError={!!archivedError}
            errorMessage={archivedError}
            pageNumber={archivedPageNumber}
            pageSize={pageSize}
            totalCount={archivedTotalCount}
            onPageChange={loadArchivedQueues}
            onRestore={async () => {}} // No restore for archived
            adminOnly={true}
            isAdmin={true} // TODO: Get from auth context
          />
        )}
      </div>
    </div>
  );
}
