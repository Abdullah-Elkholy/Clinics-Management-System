'use client';

import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { useQueue } from '../../contexts/QueueContext';
import { useAuth } from '../../contexts/AuthContext';
import { ModalProvider } from '../../contexts/ModalContext';
import { WhatsAppSessionProvider } from '../../contexts/WhatsAppSessionContext';
import { GlobalProgressProvider } from '../../contexts/GlobalProgressContext';
import { useSidebarCollapse } from '../../hooks/useSidebarCollapse';
import Header from '../Layout/Header';
import Navigation from '../Layout/Navigation';
import WelcomeScreen from '../Content/WelcomeScreen';
import ToastContainer from '../Common/ToastContainer';
import GlobalProgressIndicator from '../Common/GlobalProgressIndicator';
import QueueDashboard from '../Queue/QueueDashboard';
import OngoingTasksPanel from '../Queue/OngoingTasksPanel';
import FailedTasksPanel from '../Queue/FailedTasksPanel';
import CompletedTasksPanel from '../Queue/CompletedTasksPanel';
import MessagesPanel from '../Content/MessagesPanel';
import ManagementPanel from '../Content/ManagementPanel';

import * as Modals from '../Modals';

function MainAppContent() {
  const { selectedQueueId } = useQueue();
  const { currentPanel, isTransitioning } = useUI();
  const { isNavigatingToHome, clearNavigationFlag, user } = useAuth();
  const { isCollapsed } = useSidebarCollapse();
  const [customSidebarWidth, setCustomSidebarWidth] = React.useState<number | null>(null);

  // Check if user is admin
  const isAdmin = user?.role === 'primary_admin' || user?.role === 'secondary_admin';

  // Clear navigation flag once MainApp renders (home page is ready)
  React.useEffect(() => {
    if (isNavigatingToHome) {
      // Give a brief moment for rendering to complete, then clear flag
      const timer = setTimeout(() => {
        clearNavigationFlag();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isNavigatingToHome, clearNavigationFlag]);

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
          {/* Show loading during panel transitions to prevent glitchy UI */}
          {isTransitioning ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">جاري التحميل...</p>
              </div>
            </div>
          ) : (
            // Render based on currentPanel state (which is synced with URL)
            // Priority: currentPanel determines what to show, regardless of queue selection
            // This ensures the displayed panel always matches the URL
            currentPanel === 'ongoing' ? (
              <OngoingTasksPanel />
            ) : currentPanel === 'failed' ? (
              <FailedTasksPanel />
            ) : currentPanel === 'completed' ? (
              <CompletedTasksPanel />
            ) : currentPanel === 'welcome' ? (
              // Welcome panel: queue dashboard if queue selected, home screen otherwise
              isQueueSelected ? <QueueDashboard /> : <WelcomeScreen />
            ) : currentPanel === 'messages' ? (
              <MessagesPanel />
            ) : currentPanel === 'management' ? (
              <ManagementPanel />

            ) : (
              // Default fallback - should only happen on initial load before URL sync
              <WelcomeScreen />
            )
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function MainApp() {
  // Providers are already in app/layout.tsx, so we don't need to wrap here
  return (
    <GlobalProgressProvider>
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
        <Modals.QRCodeModal />
      </ModalProvider>

      {/* Global Progress Indicator - Visible on ALL pages */}
      <GlobalProgressIndicator />
    </GlobalProgressProvider>
  );
}
