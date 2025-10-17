import React from 'react'
import Header from './Header'
import Navigation from './Navigation'
import QueueList from './QueueList'

export default function Layout({ 
  children,
  userRole,
  userName,
  whatsappConnected,
  onLogout,
  activeSection,
  onSectionChange,
  queues,
  selectedQueue,
  onQueueSelect,
  canAddQueue,
  onAddQueue,
  onEditQueue,
  onDeleteQueue,
  onRequestAddQueue
}) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header 
        userRole={userRole}
        userName={userName}
        whatsappConnected={whatsappConnected}
        onLogout={onLogout}
      />

      <div className="flex min-h-screen pt-16">
        {/* Sidebar */}
        <aside className="w-1/4 bg-white shadow-lg border-l border-gray-200" aria-label="القائمة الجانبية">
          <Navigation 
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
          <QueueList
            queues={queues}
            selectedQueue={selectedQueue}
            onSelect={onQueueSelect}
            canAddQueue={canAddQueue}
            onAddQueue={onAddQueue}
            onRequestAddQueue={onRequestAddQueue}
            onEditQueue={onEditQueue}
            onDeleteQueue={onDeleteQueue}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto" role="main">
          <div className="p-6 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}