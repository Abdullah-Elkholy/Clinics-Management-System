'use client';

import React from 'react';
import { UIProvider, useUI } from '../../contexts/UIContext';
import { QueueProvider, useQueue } from '../../contexts/QueueContext';
import { ModalProvider } from '../../contexts/ModalContext';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';
import Header from '../Layout/Header';
import Navigation from '../Layout/Navigation';
import WelcomeScreen from '../Content/WelcomeScreen';
import ToastContainer from '../Common/ToastContainer';
import QueueDashboard from '../Queue/QueueDashboard';
import OngoingTasksPanel from '../Queue/OngoingTasksPanel';
import FailedTasksPanel from '../Queue/FailedTasksPanel';
import CompletedTasksPanel from '../Queue/CompletedTasksPanel';
import MessagesPanel from '../Content/MessagesPanel';
import ManagementPanel from '../Content/ManagementPanel';
import * as Modals from '../Modals';

function MainAppContent() {
  const { selectedQueueId } = useQueue();
  const { currentPanel } = useUI();
  const { isCollapsed, isHydrated } = useSidebarCollapse();
  const [customSidebarWidth, setCustomSidebarWidth] = React.useState<number | null>(null);

  // Listen for sidebar custom width changes and respond to collapse state
  React.useEffect(() => {
    const checkSidebarWidth = () => {
      const sidebarElement = document.querySelector('[data-sidebar-width]');
      if (sidebarElement) {
        // Get the actual computed width from the element
        const computedStyle = window.getComputedStyle(sidebarElement);
        const actualWidth = parseFloat(computedStyle.width);
        if (!isNaN(actualWidth)) {
          setCustomSidebarWidth(actualWidth);
        }
      }
    };

    checkSidebarWidth();

    // Check on interval during drag and on window resize
    const interval = setInterval(checkSidebarWidth, 50);
    window.addEventListener('resize', checkSidebarWidth);
    
    // Also listen for mutations
    const observer = new MutationObserver(checkSidebarWidth);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-sidebar-width', 'class'] });

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', checkSidebarWidth);
      observer.disconnect();
    };
  }, []);

  // Ensure spacer updates when isCollapsed changes (from button toggle)
  React.useEffect(() => {
    // Force a width check when collapse state changes
    const sidebarElement = document.querySelector('[data-sidebar-width]');
    if (sidebarElement) {
      const computedStyle = window.getComputedStyle(sidebarElement);
      const actualWidth = parseFloat(computedStyle.width);
      if (!isNaN(actualWidth)) {
        setCustomSidebarWidth(actualWidth);
      }
    }
  }, [isCollapsed]);

  const isQueueSelected = selectedQueueId !== null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      {/* Fixed Navigation (sidebar) - positioned fixed on right */}
      <Navigation />
      
      {/* Main content area with spacer to prevent overlap */}
      <div className="flex flex-1 overflow-hidden pt-20 md:pt-24">
        {/* Spacer: mirrors sidebar width to prevent content overlap */}
        <div
          style={{
            width: `${customSidebarWidth || 0}px`,
            minWidth: `${customSidebarWidth || 0}px`
          }}
          className="flex-shrink-0 transition-all duration-300 ease-in-out"
        />
        
        <div className="flex-1 bg-white overflow-y-auto">
          {isQueueSelected ? (
            currentPanel === 'ongoing' ? (
              <OngoingTasksPanel />
            ) : currentPanel === 'failed' ? (
              <FailedTasksPanel />
            ) : currentPanel === 'done' ? (
              <CompletedTasksPanel />
            ) : (
              <QueueDashboard />
            )
          ) : currentPanel === 'messages' ? (
            <MessagesPanel />
          ) : currentPanel === 'management' ? (
            <ManagementPanel />
          ) : (
            <WelcomeScreen />
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function MainApp() {
  return (
    <UIProvider>
      <QueueProvider>
        <ModalProvider>
          <MainAppContent />
          <Modals.AddQueueModal />
          <Modals.AddPatientModal />
          <Modals.UploadModal />
          <Modals.AddTemplateModal />
          <Modals.EditTemplateModal />
          <Modals.AccountInfoModal />
          <Modals.WhatsAppAuthModal />
          <Modals.EditQueueModal />
          <Modals.EditUserModal />
          <Modals.AddUserModal />
          <Modals.EditPatientModal />
          <Modals.MessageSelectionModal />
          <Modals.MessagePreviewModal />
          <Modals.ManageConditionsModal />
          <Modals.RetryPreviewModal />
          <Modals.QuotaManagementModal />
        </ModalProvider>
      </QueueProvider>
    </UIProvider>
  );
}
