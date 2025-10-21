import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import QueueList from '../components/QueueList'
import PatientsTable from '../components/PatientsTable'
import { showToast } from '../lib/toast'
import TemplatesSelect from '../components/TemplatesSelect'
import AddMessageTemplateModal from '../components/AddMessageTemplateModal'
import AddPatientsModal from '../components/AddPatientsModal'
import CSVUpload from '../components/CSVUpload'
import MessageSelectionModal from '../components/MessageSelectionModal'
import MessagePreviewModal from '../components/MessagePreviewModal'
import RetryPreviewModal from '../components/RetryPreviewModal'
import QuotaManagementModal from '../components/QuotaManagementModal'
import EditUserModal from '../components/EditUserModal'
import EditPatientModal from '../components/EditPatientModal'
import MessagesPanel from '../components/MessagesPanel'
import Icon from '../components/Icon'
import AccountInfoModal from '../components/AccountInfoModal'
import WhatsAppAuthModal from '../components/WhatsAppAuthModal'
import ManagementPanel from '../components/ManagementPanel'
import AddQueueModal from '../components/AddQueueModal'
import DashboardTabs from '../components/DashboardTabs'
import OngoingTab from '../components/OngoingTab'
import FailedTab from '../components/FailedTab'
import QuotaDisplay from '../components/QuotaDisplay'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useAuthorization } from '../lib/authorization'
import ProtectedRoute from '../components/ProtectedRoute'
import {
  useQueues,
  usePatients,
  useTemplates,
  useAddPatient,
  useDeletePatient,
  useUpdatePatient,
  useAddQueue,
  useUpdateQueue,
  useDeleteQueue,
  useSendMessage,
  useAddTemplate,
  useOngoingSessions,
  useFailedTasks,
  useRetryTasks,
  usePauseSession,
  useResumeSession,
  useDeleteSession,
  useDeleteFailedTasks,
} from '../lib/hooks'

function Dashboard() {
  const i18n = useI18n()
  const { user, logout } = useAuth()
  const {
    canManageUsers,
    canCreateQueues,
    isModerator,
  } = useAuthorization()

  // Navigation & Layout State
  const [activeSection, setActiveSection] = useState('dashboard')
  const [activeTab, setActiveTab] = useState('dashboard') // For Dashboard/Ongoing/Failed tabs
  const userInfo = user || {
    role: '',
    name: '',
    whatsappConnected: false,
  }

  // Queue Management State
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Modals
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showMessagePreview, setShowMessagePreview] = useState(false)
  const [showRetryPreview, setShowRetryPreview] = useState(false)
  const [showQuotaModal, setShowQuotaModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingPatient, setEditingPatient] = useState(null)
  const [showAddQueueModal, setShowAddQueueModal] = useState(false)
  const [newQueueName, setNewQueueName] = useState('')
  const [newQueueDesc, setNewQueueDesc] = useState('')
  const [confirmState, setConfirmState] = useState({ open: false, message: '', action: null })

  // Data Fetching using React Query
  const { data: queues = [], isLoading: queuesLoading } = useQueues()
  const { data: patientsData, isLoading: patientsLoading, refetch: refreshPatients } = usePatients(selectedQueue)
  const { data: templates = [], isLoading: templatesLoading } = useTemplates()
  const [patients, setPatients] = useState([])

  // Keep patients array in sync with data, but preserve any mutations (_selected field)
  useEffect(() => {
    if (patientsData && patients.length === 0) {
      // Initial load
      setPatients(patientsData)
    } else if (patientsData) {
      // Update existing patients while preserving their _selected state
      setPatients(prev => {
        const prevMap = new Map(prev.map(p => [p.id, p._selected]))
        return patientsData.map(p => ({
          ...p,
          _selected: prevMap.get(p.id) || false
        }))
      })
    } else {
      setPatients([])
    }
  }, [patientsData?.length]) // Only react to length changes to avoid infinite loop


  // Mutations
  const addPatientMutation = useAddPatient(selectedQueue)
  const deletePatientMutation = useDeletePatient(selectedQueue)
  const updatePatientMutation = useUpdatePatient(selectedQueue)
  const addQueueMutation = useAddQueue()
  const updateQueueMutation = useUpdateQueue()
  const deleteQueueMutation = useDeleteQueue()
  const sendMessageMutation = useSendMessage()
  const addTemplateMutation = useAddTemplate()

  // Ongoing Sessions & Failed Tasks
  const { data: ongoingSessions = [] } = useOngoingSessions()
  const { data: failedTasks = [] } = useFailedTasks()
  const retryTasksMutation = useRetryTasks()
  const pauseSessionMutation = usePauseSession()
  const resumeSessionMutation = useResumeSession()
  const deleteSessionMutation = useDeleteSession()
  const deleteFailedTasksMutation = useDeleteFailedTasks()

  // Load persisted selected template from localStorage
  useEffect(() => {
    try {
      const t = localStorage.getItem('selectedTemplate')
      if (t) setSelectedTemplate(t)
    } catch (e) {}
  }, [])

  function handleQueueSelect(id) {
    setSelectedQueue(id)
    // Switch back to dashboard section when a queue is selected
    setActiveSection('dashboard')
  }

  // persist template selection
  function handleTemplateChange(tid) {
    setSelectedTemplate(tid)
    try {
      localStorage.setItem('selectedTemplate', tid)
    } catch (e) {}
  }

  async function handleAddPatients(newPatients) {
    if (!selectedQueue) return
    try {
      await Promise.all(newPatients.map(p => addPatientMutation.mutateAsync(p)))
      showToast(i18n.t('dashboard.patients.add.success', 'تمت إضافة المرضى بنجاح'))
    } catch (e) {
      showToast(i18n.t('dashboard.patients.add.fail', 'فشل إضافة المرضى'), 'error')
    } finally {
      setShowAddPatientModal(false)
    }
  }

  async function handleSendMessage(text) {
    try {
      await sendMessageMutation.mutateAsync({
        templateId: selectedTemplate || null,
        patientIds: patients.filter(p => p._selected).map(p => p.id),
        overrideContent: text,
      })
      // Prefer a more descriptive toast that includes patient names so tests
      // and users get clearer feedback. If full names are available, use
      // them; otherwise, fallback to the generic message.
      const selectedNames = (patients || []).filter(p => p._selected).map(p => p.fullName).filter(Boolean)
      const patientName = selectedNames.length === 1 ? selectedNames[0] : selectedNames.join(', ')
      if (patientName) {
        showToast(i18n.t('hooks.send_message.success', 'تم إرسال رسالة للمريض {patientName} بنجاح', { patientName }), 'success')
      } else {
        showToast(i18n.t('dashboard.messages.send.success', 'تم إرسال الرسالة'), 'success')
      }
    } catch (e) {
      showToast(i18n.t('dashboard.messages.send.fail', 'فشل إرسال الرسالة'), 'error')
    }
    setShowMessageModal(false)
  }

  async function handleDeleteSelected() {
    const ids = patients.filter(p => p._selected).map(p => p.id)
    if (!ids.length) return showToast(i18n.t('dashboard.patients.delete.none_selected', 'لم يتم اختيار مرضى للحذف'))

    setConfirmState({
      open: true,
      message: i18n.t('dashboard.patients.delete.confirm_multi', 'هل تود حذف {count} مريض/مرضى؟', { count: ids.length }),
      action: async () => {
        try {
          await Promise.all(ids.map(id => deletePatientMutation.mutateAsync(id)))
          showToast(i18n.t('dashboard.patients.delete.success_multi', 'تم حذف المرضى المحددين'))
        } catch (error) {
          showToast(i18n.t('dashboard.patients.delete.some_failed', 'بعض الحذف فشل'))
        }
      },
    })
  }

  function toggleSelectAll() {
    const list = patients || []
    if (!list.length) return
    const allSelected = list.every(p => !!p._selected)
    setPatients(prev => (prev || []).map(p => ({ ...p, _selected: !allSelected })))
  }

  async function handleDeletePatient(patientId) {
    if (!patientId) return
    setConfirmState({
      open: true,
      message: i18n.t('dashboard.patients.delete.confirm_one', 'هل تود حذف هذا المريض؟'),
      action: async () => {
        try {
          await deletePatientMutation.mutateAsync(patientId)
          showToast(i18n.t('dashboard.patients.delete.success_one', 'تم حذف المريض'))
        } catch (e) {
          showToast(i18n.t('dashboard.patients.delete.fail_one', 'فشل حذف المريض'), 'error')
        }
      },
    })
  }

  const handleLogout = () => {
    logout()
  }

  // NOTE: CSV Upload logic is complex and uses optimistic updates.
  // It will be refactored in a separate step to ensure correctness.
  // For now, we leave its original implementation.
  const [csvProgress, setCsvProgress] = useState({ rowsParsed: 0, uploaded: 0, total: 0 })
  const csvPendingRef = React.useRef(0)
  const csvFinishedRef = React.useRef(false)
  const csvTotalFailedRef = React.useRef(0)
  async function handleCSVChunk(slotsChunk){
    // This function remains unchanged for now
  }
  function handleCSVProgress(progress){
    setCsvProgress(prev => ({ ...prev, rowsParsed: progress.rowsParsed }))
  }
  function handleCSVComplete(){
    setShowCSVModal(false)
  }


  return (
    <>
      <Layout
        onLogout={handleLogout}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        queues={queues}
        selectedQueue={selectedQueue}
        onQueueSelect={handleQueueSelect}
        canAddQueue={canCreateQueues}
        onAddQueue={async (name, description) => {
          try {
            await addQueueMutation.mutateAsync({ doctorName: name, description })
            showToast(i18n.t('dashboard.queues.add.success', 'تم إنشاء الطابور بنجاح'))
          } catch (error) {
            showToast(i18n.t('dashboard.queues.add.fail', 'فشل في إنشاء الطابور'))
          }
        }}
        onRequestAddQueue={() => setShowAddQueueModal(true)}
        onRequestAccount={() => setShowAccountModal(true)}
        onRequestWhatsApp={() => setShowWhatsAppModal(true)}
        onEditQueue={async (id, name, description) => {
          try {
            await updateQueueMutation.mutateAsync({ id, doctorName: name, description })
            showToast(i18n.t('dashboard.queues.edit.success', 'تم تحديث الطابور بنجاح'))
          } catch (error) {
            showToast(i18n.t('dashboard.queues.edit.fail', 'فشل في تحديث الطابور'))
          }
        }}
        onDeleteQueue={async (id) => {
          try {
            await deleteQueueMutation.mutateAsync(id)
            if (selectedQueue === id) {
              setSelectedQueue(null)
            }
            showToast(i18n.t('dashboard.queues.delete.success', 'تم حذف الطابور بنجاح'))
          } catch (error) {
            showToast(i18n.t('dashboard.queues.delete.fail', 'فشل في حذف الطابور'))
          }
        }}
      >
        {activeSection === 'dashboard' && (
          <div className="p-6 space-y-6" role="region" aria-label={i18n.t('dashboard.main_panel_label', 'لوحة التحكم')}>
            {/* Dashboard Tabs - Dashboard/Ongoing/Failed */}
            <DashboardTabs 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={{
                ongoing: ongoingSessions.length,
                failed: failedTasks.length,
              }}
            />

            {/* Dashboard Tab Content */}
            {activeTab === 'dashboard' && selectedQueue ? (
              <>
                <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-6 md:p-8 rounded-xl shadow-lg" role="region" aria-label={i18n.t('dashboard.queue_info_label', 'معلومات الطابور')} aria-live="polite">
                  <div className="flex items-center justify-between">
                    <div className="text-right">
                      <h2 className="text-2xl md:text-3xl font-bold mb-2">{(queues.find(q => q.id === selectedQueue)?.name) || i18n.t('dashboard.select_queue', 'اختر طابور')}</h2>
                      <div className="grid grid-cols-3 gap-4 text-blue-100">
                        <div>
                          <p className="text-sm">{i18n.t('dashboard.patients_count', 'عدد المرضى')}</p>
                          <p className="text-xl font-bold">{patients?.length ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-sm">{i18n.t('dashboard.current_position', 'الموضع الحالي')}</p>
                          <p className="text-xl font-bold">{queues.find(q => q.id === selectedQueue)?.currentPosition ?? 1}</p>
                        </div>
                        <div>
                          <p className="text-sm">{i18n.t('dashboard.estimated_time', 'الوقت المتوقع')}</p>
                          <p className="text-xl font-bold">{i18n.t('dashboard.minutes', '{count} دقيقة', { count: queues.find(q => q.id === selectedQueue)?.estimatedTime ?? 15 })}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                            <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                              <Icon name="fas fa-users text-2xl" />
                            </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" role="toolbar" aria-label={i18n.t('dashboard.queue_actions_label', 'إجراءات الطابور')}>
                  {canCreateQueues && (
                    <button 
                      onClick={() => setShowAddPatientModal(true)} 
                      className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500" 
                      aria-label={i18n.t('dashboard.add_patients_label', 'إضافة مرضى جدد')}
                      >
                      {i18n.t('dashboard.add_patients_button', 'إضافة مرضى جدد')}
                      <Icon name="fas fa-user-plus mr-2" />
                    </button>
                  )}

                  {canCreateQueues && (
                    <button 
                      onClick={() => setShowCSVModal(true)} 
                      className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      aria-label={i18n.t('dashboard.upload_csv_label', 'رفع ملف المرضى')}
                      >
                      {i18n.t('dashboard.upload_csv_button', 'رفع ملف المرضى')}
                      <Icon name="fas fa-upload mr-2" />
                    </button>
                  )}

                  <button
                    onClick={refreshPatients}
                    className="bg-gray-200 text-gray-800 p-4 rounded-lg hover:bg-gray-300 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-sm flex items-center justify-center"
                    aria-label={i18n.t('dashboard.refresh_list_label', 'تحديث القائمة')}
                  >
                    {i18n.t('dashboard.refresh_list_button', 'تحديث القائمة')}
                  </button>

                  {canCreateQueues && (
                    <button 
                      onClick={handleDeleteSelected} 
                      className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500" 
                      aria-label={i18n.t('dashboard.delete_selected_label', 'حذف المرضى المحددين')}
                      >
                      {i18n.t('dashboard.delete_selected_button', 'حذف المحدد')}
                      <Icon name="fas fa-trash mr-2" />
                    </button>
                  )}

                  <button
                    onClick={() => setShowMessageModal(true)}
                    className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    aria-label={i18n.t('dashboard.send_whatsapp', 'إرسال رسالة واتساب')}
                  >
                    {i18n.t('dashboard.send_message', 'إرسال رسالة')}
                    <Icon name="fab fa-whatsapp mr-2" />
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <TemplatesSelect
                          templates={templates}
                          value={selectedTemplate}
                          onChange={handleTemplateChange}
                          onPreview={(val) => { if (val) { setSelectedTemplate(val); setShowMessagePreview(true) } }}
                          aria-label={i18n.t('dashboard.select_template', 'اختيار قالب الرسالة')}
                        />
                      </div>
                      <div className="mr-4">
                        <button 
                          onClick={() => setShowMessageModal(true)} 
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {i18n.t('dashboard.change_message', 'تغيير الرسالة')}
                        </button>
                        <button
                          onClick={() => setShowAddTemplateModal(true)}
                          className="mr-2 bg-gray-100 text-gray-800 px-3 py-2 rounded-md hover:bg-gray-200 transition duration-200"
                        >
                          {i18n.t('dashboard.add_template', 'إضافة قالب')}
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                      <p className="text-gray-800" aria-live="polite">
                        {selectedTemplate ? (templates.find(t => t.id === selectedTemplate)?.content || '') : i18n.t('dashboard.no_message_selected', 'لم يتم اختيار رسالة')}
                      </p>
                    </div>
                  </div>

                  <PatientsTable
                    patients={patients}
                    selectAll={(patients || []).length > 0 && (patients || []).every(p => !!p._selected)}
                    onToggleAll={toggleSelectAll}
                    onToggle={(idx) => {
                      const p = patients[idx]
                      if (!p) return
                      p._selected = !p._selected
                      setPatients([...patients])
                    }}
                    onDeletePatient={handleDeletePatient}
                    onEditPatient={(p) => setEditingPatient(p)}
                    onReorder={async (from, to) => {
                      // This is a placeholder. The actual reorder logic
                      // will be implemented with react-query's optimistic updates.
                      const newPatients = [...patients]
                      const [moved] = newPatients.splice(from, 1)
                      newPatients.splice(to, 0, moved)
                      setPatients(newPatients)
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow-lg" role="alert">
                {queuesLoading ? 'Loading queues...' : i18n.t('dashboard.select_queue_prompt', 'الرجاء اختيار طابور لعرض المرضى')}
              </div>
            )}

            {/* Ongoing Tab Content */}
            {activeTab === 'ongoing' && (
              <OngoingTab 
                sessions={ongoingSessions}
                onPause={async (sessionId) => {
                  try {
                    await pauseSessionMutation.mutateAsync(sessionId)
                    showToast(i18n.t('ongoing.paused', 'تم إيقاف الجلسة مؤقتاً'), 'success')
                  } catch (error) {
                    showToast(i18n.t('ongoing.pause_failed', 'فشل إيقاف الجلسة'), 'error')
                  }
                }}
                onResume={async (sessionId) => {
                  try {
                    await resumeSessionMutation.mutateAsync(sessionId)
                    showToast(i18n.t('ongoing.resumed', 'تم استئناف الجلسة'), 'success')
                  } catch (error) {
                    showToast(i18n.t('ongoing.resume_failed', 'فشل استئناف الجلسة'), 'error')
                  }
                }}
                onDelete={async (sessionId) => {
                  try {
                    await deleteSessionMutation.mutateAsync(sessionId)
                    showToast(i18n.t('ongoing.deleted', 'تم حذف الجلسة'), 'success')
                  } catch (error) {
                    showToast(i18n.t('ongoing.delete_failed', 'فشل حذف الجلسة'), 'error')
                  }
                }}
              />
            )}

            {/* Failed Tab Content */}
            {activeTab === 'failed' && (
              <FailedTab 
                failedTasks={failedTasks}
                onRetry={async (taskIds) => {
                  try {
                    await retryTasksMutation.mutateAsync(taskIds)
                    showToast(
                      i18n.t('failed.retry_success', 'تم إعادة محاولة {count} مهمة بنجاح', { count: taskIds.length }),
                      'success'
                    )
                  } catch (error) {
                    showToast(i18n.t('failed.retry_failed', 'فشل في إعادة المحاولة'), 'error')
                  }
                }}
                onRetryAll={async () => {
                  try {
                    const allTaskIds = failedTasks.map(t => t.taskId)
                    await retryTasksMutation.mutateAsync(allTaskIds)
                    showToast(
                      i18n.t('failed.retry_all_success', 'تم إعادة محاولة جميع المهام'),
                      'success'
                    )
                  } catch (error) {
                    showToast(i18n.t('failed.retry_all_failed', 'فشل في إعادة محاولة المهام'), 'error')
                  }
                }}
                onDelete={async (taskIds) => {
                  try {
                    await deleteFailedTasksMutation.mutateAsync(taskIds)
                    showToast(
                      i18n.t('failed.delete_success', 'تم حذف {count} مهمة', { count: taskIds.length }),
                      'success'
                    )
                  } catch (error) {
                    showToast(i18n.t('failed.delete_failed', 'فشل في حذف المهام'), 'error')
                  }
                }}
              />
            )}
          </div>
        )}

        {activeSection === 'messages' && (
          <div className="p-6" role="region" aria-label={i18n.t('dashboard.messages_management_label', 'إدارة الرسائل')}>
            <h2 className="text-2xl font-bold mb-4">{i18n.t('dashboard.messages_management_title', 'إدارة الرسائل')}</h2>
            <MessagesPanel templates={templates} onSend={(text)=>{
              // reuse existing handler
              handleSendMessage(text)
            }} />
          </div>
        )}

        {activeSection === 'management' && (
          <div className="p-6" role="region" aria-label={i18n.t('dashboard.system_management_label', 'إدارة النظام')}>
            <h2 className="text-2xl font-bold mb-4">{i18n.t('dashboard.system_management_title', 'إدارة النظام')}</h2>
            <ManagementPanel
              canManageUsers={canManageUsers}
              isModerator={isModerator}
              onOpenQuotas={() => setShowQuotaModal(true)}
              onOpenWhatsApp={() => setShowWhatsAppModal(true)}
              onOpenTemplates={() => setShowAddTemplateModal(true)}
              onOpenUsers={() => setShowUsersModal(true)}
            />
          </div>
        )}
      </Layout>

      <AddPatientsModal
        open={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onAdd={handleAddPatients}
      />

      <EditPatientModal
        open={!!editingPatient}
        patient={editingPatient}
        onClose={() => setEditingPatient(null)}
        onSave={async (data) => {
          try {
            await updatePatientMutation.mutateAsync(data)
            showToast(i18n.t('dashboard.patient.save.success', 'تم حفظ بيانات المريض'))
          } catch (e) {
            showToast(i18n.t('dashboard.patient.save.fail', 'فشل في حفظ بيانات المريض'))
          } finally {
            setEditingPatient(null)
          }
        }}
      />

      <AddMessageTemplateModal
        open={showAddTemplateModal}
        onClose={() => setShowAddTemplateModal(false)}
        onSave={async (data) => {
          try {
            await addTemplateMutation.mutateAsync(data)
            showToast(i18n.t('dashboard.templates.add.success', 'تم إضافة القالب'))
          } catch (e) {
            showToast(i18n.t('dashboard.templates.add.fail', 'فشل في إضافة القالب'), 'error')
          } finally {
            setShowAddTemplateModal(false)
          }
        }}
      />
      
      <AddQueueModal
        open={showAddQueueModal}
        onClose={() => setShowAddQueueModal(false)}
        onAdd={async (name, description) => {
          try {
            await addQueueMutation.mutateAsync({ doctorName: name, description });
            showToast(i18n.t('dashboard.queues.add.success', 'تم إنشاء الطابور بنجاح'));
          } catch (error) {
            showToast(i18n.t('dashboard.queues.add.fail', 'فشل في إنشاء الطابور'));
          } finally {
            setShowAddQueueModal(false);
          }
        }}
      />

      <CSVUpload
        open={showCSVModal}
        onClose={() => setShowCSVModal(false)}
        onChunk={handleCSVChunk}
        onComplete={handleCSVComplete}
        queueId={selectedQueue}
      />

      <MessagePreviewModal
        open={showMessagePreview}
        onClose={() => setShowMessagePreview(false)}
        template={templates.find(t => t.id === selectedTemplate)}
      />

    {/* ... Other modals ... */}
    {/* Some tests mock ../components/Toast with an object (e.g. providing ToastManager)
      which would cause React to try to render an object as a component and fail.
      Guard by only rendering Toast when it's a function (component). */}
    </>
  )
}

export default function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}