/**
 * Patients Management Page with Trash Integration
 * File: apps/web/components/Queue/PatientsManagementView.tsx
 * 
 * Integrates the TrashTab component for soft-deleted patient management
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { patientsApiClient } from '@/services/api/patientsApiClient';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import TrashTab from '@/components/TrashTab';
import { TabNavigation } from '@/components/Common/TabNavigation';
import logger from '@/utils/logger';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

export default function PatientsManagementView() {
  const { selectedQueueId } = useQueue();
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

  // Load trash patients
  const loadTrashPatients = useCallback(
    async (page: number) => {
      if (!selectedQueueId) return;
      setIsLoadingTrash(true);
      setTrashError('');
      try {
        const response = await patientsApiClient.getTrashPatients(Number(selectedQueueId), {
          pageNumber: page,
          pageSize,
        });
        setTrashItems(response.items);
        setTrashTotalCount(response.totalCount);
        setTrashPageNumber(page);
      } catch (error: any) {
        setTrashError(error?.message || 'Failed to load trash patients');
        logger.error('Error loading trash patients:', error);
      } finally {
        setIsLoadingTrash(false);
      }
    },
    [selectedQueueId]
  );

  // Load archived patients
  const loadArchivedPatients = useCallback(
    async (page: number) => {
      if (!selectedQueueId) return;
      setIsLoadingArchived(true);
      setArchivedError('');
      try {
        const response = await patientsApiClient.getArchivedPatients(Number(selectedQueueId), {
          pageNumber: page,
          pageSize,
        });
        setArchivedItems(response.items);
        setArchivedTotalCount(response.totalCount);
        setArchivedPageNumber(page);
      } catch (error: any) {
        setArchivedError(error?.message || 'Failed to load archived patients');
        logger.error('Error loading archived patients:', error);
      } finally {
        setIsLoadingArchived(false);
      }
    },
    [selectedQueueId]
  );

  // Load trash on tab change
  useEffect(() => {
    if (activeTab === 'trash') {
      loadTrashPatients(1);
    }
  }, [activeTab, loadTrashPatients]);

  // Load archived on tab change
  useEffect(() => {
    if (activeTab === 'archived') {
      loadArchivedPatients(1);
    }
  }, [activeTab, loadArchivedPatients]);

  // Handle restore
  const handleRestore = useCallback(
    async (patientId: string | number) => {
      try {
        await patientsApiClient.restorePatient(Number(patientId));
        addToast('Patient restored successfully', 'success');
        // Reload trash list
        loadTrashPatients(trashPageNumber);
      } catch (error: any) {
        addToast(error?.message || 'Failed to restore patient', 'error');
        throw error;
      }
    },
    [trashPageNumber, loadTrashPatients, addToast]
  );

  if (!selectedQueueId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Please select a queue first.</p>
      </div>
    );
  }

  const tabs: Tab[] = [
    { id: 'active', label: 'Active Patients', icon: 'fa-users' },
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
            <h2 className="text-xl font-semibold mb-4">Active Patients</h2>
            <p className="text-gray-600">Active patients will appear here.</p>
            {/* TODO: Add active patients list */}
          </div>
        )}

        {activeTab === 'trash' && (
          <TrashTab
            entityType="patient"
            items={trashItems}
            isLoading={isLoadingTrash}
            isError={!!trashError}
            errorMessage={trashError}
            pageNumber={trashPageNumber}
            pageSize={pageSize}
            totalCount={trashTotalCount}
            onPageChange={loadTrashPatients}
            onRestore={handleRestore}
            adminOnly={false}
            isAdmin={true} // TODO: Get from auth context
          />
        )}

        {activeTab === 'archived' && (
          <TrashTab
            entityType="patient"
            items={archivedItems}
            isLoading={isLoadingArchived}
            isError={!!archivedError}
            errorMessage={archivedError}
            pageNumber={archivedPageNumber}
            pageSize={pageSize}
            totalCount={archivedTotalCount}
            onPageChange={loadArchivedPatients}
            onRestore={async () => {}} // No restore for archived
            adminOnly={true}
            isAdmin={true} // TODO: Get from auth context
          />
        )}
      </div>
    </div>
  );
}
