'use client';

import { UIProvider, useUI } from '../../contexts/UIContext';
import { QueueProvider, useQueue } from '../../contexts/QueueContext';
import { ModalProvider } from '../../contexts/ModalContext';
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

  const isQueueSelected = selectedQueueId !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex h-screen pt-16">
        <Navigation />
        
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
          <Modals.AccountInfoModal />
          <Modals.WhatsAppAuthModal />
          <Modals.EditQueueModal />
          <Modals.EditUserModal />
          <Modals.EditPatientModal />
          <Modals.MessageSelectionModal />
          <Modals.MessagePreviewModal />
          <Modals.RetryPreviewModal />
          <Modals.QuotaManagementModal />
        </ModalProvider>
      </QueueProvider>
    </UIProvider>
  );
}
