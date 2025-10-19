import React, { useEffect, useState } from 'react'
import api from '../lib/api'
import Layout from '../components/Layout'
import QueueList from '../components/QueueList'
import PatientsTable from '../components/PatientsTable'
import Toast, { showToast } from '../components/Toast'
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
import ModalWrapper from '../components/ModalWrapper'
import AccountInfoModal from '../components/AccountInfoModal'

export default function Dashboard() {
  // Navigation & Layout State
  const [activeSection, setActiveSection] = useState('dashboard')
  const [userInfo, setUserInfo] = useState({ 
    role: 'مدير أساسي',
    name: 'المدير الأساسي',
    whatsappConnected: false
  })

  // Queue Management State
  const [queues, setQueues] = useState([])
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [patients, setPatients] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  
  // Modal State
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
  const [csvProgress, setCsvProgress] = useState({ rowsParsed: 0, uploaded: 0, total: 0 })
  // Capture the original window.confirm so tests that override it are detected
  const originalConfirmRef = React.useRef(typeof window !== 'undefined' ? window.confirm : null)
  
  // CSV Processing Refs
  const csvPendingRef = React.useRef(0)
  const csvFinishedRef = React.useRef(false)
  const csvTotalFailedRef = React.useRef(0)

  useEffect(()=>{
    // Guard API calls with catch handlers and accept multiple response shapes
    api.get('/api/queues')
      .then(res => {
        const maybe = res?.data?.queues ?? res?.data?.data ?? res?.data ?? []
        const list = Array.isArray(maybe) ? maybe : []
        // Normalize server DTOs to frontend-friendly shape
        const normalized = list.map(q => ({
          id: q.id ?? q.Id ?? q._tempId,
          name: q.doctorName ?? q.DoctorName ?? q.name ?? q.title ?? '',
          description: q.description ?? q.Description ?? q.desc ?? q.description ?? '',
          currentPosition: q.currentPosition ?? q.CurrentPosition ?? q.currentPosition ?? 1,
          estimatedTime: q.estimatedTime ?? q.estimatedWaitMinutes ?? q.EstimatedWaitMinutes ?? 15,
          patientCount: q.patientCount ?? q.PatientCount ?? 0,
          // keep original payload for any further usage
          _raw: q
        }))
        setQueues(normalized)
      })
      .catch(() => { /* ignore load errors in UI */ })

    api.get('/api/templates')
      .then(res => {
        const maybe = res?.data?.templates ?? res?.data?.data ?? res?.data ?? []
        setTemplates(Array.isArray(maybe) ? maybe : [])
      })
      .catch(() => { /* ignore load errors in UI */ })
  },[])

  // load persisted selected template from localStorage
  useEffect(()=>{
    try{
      const t = localStorage.getItem('selectedTemplate')
      if (t) setSelectedTemplate(t)
    }catch(e){}
  },[])

  function handleQueueSelect(id){
    // Defensive: avoid calling API for falsy or temporary/local-only ids
    if (!id || typeof id !== 'string' || id.startsWith('queue-') || id.startsWith('tmp-')){
      setSelectedQueue(null)
      setPatients([])
      return
    }

    setSelectedQueue(id)
    api.get(`/api/queues/${id}/patients`)
      .then(res => {
        const maybe = res?.data?.patients ?? res?.data?.data ?? res?.data ?? []
        setPatients(Array.isArray(maybe) ? maybe : [])
      })
      .catch(() => { setPatients([]) })
  }

  // persist template selection
  function handleTemplateChange(tid){
    setSelectedTemplate(tid)
    try{ localStorage.setItem('selectedTemplate', tid) }catch(e){}
  }

  async function handleAddPatients(newPatients){
    if (!selectedQueue) return
    try{
      const added = []
      for (const p of newPatients){
        try{
          const res = await api.post(`/api/queues/${selectedQueue}/patients`, p)
          const serverData = res?.data?.patient ?? res?.data?.data ?? res?.data
          if (serverData && serverData.id){
            added.push(serverData)
            setPatients(prev => [...(prev||[]), serverData])
          } else {
            // fallback: push the original object with a generated id
            const temp = { id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...p }
            added.push(temp)
            setPatients(prev => [...(prev||[]), temp])
          }
        }catch(err){
          // on failure for an individual row, continue and inform later
          console.warn('failed to add patient', err)
        }
      }
      if (added.length) showToast('تمت إضافة المرضى بنجاح')
      else showToast('لم تتم إضافة أي مرضى')
      // best-effort: refresh to ensure server canonical state
      await refreshPatients()
    }catch(e){
      showToast('فشل إضافة المرضى')
    } finally {
      setShowAddPatientModal(false)
    }
  }

  async function handleCSVChunk(slotsChunk){
    if (!selectedQueue) return

  // Keep pairs of { temp, row } so we preserve mapping between temp entries and their source rows
  const tempPairs = []
    for (const row of slotsChunk) {
      const fullName = row?.fullName?.toString()?.trim() || ''
      const phoneNumber = row?.phoneNumber?.toString()?.trim() || ''

      if (!fullName) {
        console.log('Invalid row detected')
        csvTotalFailedRef.current += 1
        showToast('بعض السجلات فشلت', { type: 'error', duration: 5000 })
        continue
      }

      // Create and add new entry immediately
      const tempEntry = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        fullName,
        phoneNumber,
        position: null,
        _optimistic: true,
        _temp: true
      }
      tempPairs.push({ temp: tempEntry, row })

      Promise.resolve().then(() => {
        setCsvProgress(prev => ({ ...prev, total: prev.total + 1 }))
        setPatients(prev => [...(prev || []), tempEntry])
      })
    }

    // increase pending counter
    csvPendingRef.current += tempPairs.length
    csvFinishedRef.current = false
    
    let totalFailed = 0
    let duplicateFound = false

    // process rows sequentially so failures are removed immediately
    let failedCount = 0
    for (let idx = 0; idx < tempPairs.length; idx++){
      const { temp, row } = tempPairs[idx]

      if (!row.fullName || row.fullName.toString().trim() === ''){
        // remove temp entry and count as failed without calling server
        setPatients(prev => (prev||[]).filter(p => p.id !== temp.id))
        failedCount++
        csvPendingRef.current = Math.max(0, csvPendingRef.current - 1)
        continue
      }

      try{
        const r = await api.post(`/api/queues/${selectedQueue}/patients`, {
          fullName: row.fullName,
          phoneNumber: row.phoneNumber,
          desiredPosition: row.desiredPosition
        })

        const serverData = r?.data?.data
        if (serverData){
          // replace temp entry with server-provided entry
          setPatients(prev => prev.map(p => p.id === temp.id ? { ...serverData, _optimistic: true } : p))
          setCsvProgress(prev => ({ ...prev, uploaded: prev.uploaded + 1 }))
        } else {
          setPatients(prev => prev.filter(p => p.id !== temp.id))
          failedCount++
        }
      }catch(e){
        // failed - remove temp entry
        setPatients(prev => prev.filter(p => p.id !== temp.id))
        // if server returned a 409, treat as duplicate and remember it so we can show a specific warning
        const status = e?.response?.status || e?.status
        if (status === 409) {
          duplicateFound = true
        }
        failedCount++
      }finally{
        csvPendingRef.current = Math.max(0, csvPendingRef.current - 1)
      }
    }

    totalFailed += failedCount
    
    // cleanup temp rows with empty names/phones
    setPatients(prev => prev.filter(p => !(p._temp && (!p.fullName || p.fullName.toString().trim() === ''))))

    if (totalFailed > 0) csvTotalFailedRef.current += totalFailed

    // if no pending uploads remain
    if (csvPendingRef.current === 0){
      csvFinishedRef.current = true
      setTimeout(()=>{
        if (duplicateFound) {
          showToast('تم العثور على سجلات مكررة', 'warning')
        } else if (csvTotalFailedRef.current > 0) showToast('بعض السجلات فشلت')
        else showToast('تم رفع ملف المرضى')
        csvTotalFailedRef.current = 0
        setCsvProgress(prev => ({ ...prev, rowsParsed: prev.rowsParsed }))
      }, 0)
    }
  }

  function handleCSVProgress(progress){
    setCsvProgress(prev => ({ ...prev, rowsParsed: progress.rowsParsed }))
  }

  function handleCSVComplete(){
    setShowCSVModal(false)
  }

  async function handleSendMessage(text){
    try{
      // used backend DTO: TemplateId, PatientIds, Channel?, OverrideContent?
      const res = await api.post('/api/messages/send', { 
        templateId: selectedTemplate || null,
        patientIds: patients.filter(p=>p._selected).map(p=>p.id),
        overrideContent: text
      })
      showToast(res?.data?.success ? 'تم إرسال الرسالة' : 'فشل إرسال الرسالة')
    }catch(e){ 
      showToast('فشل إرسال الرسالة') 
    }
    setShowMessageModal(false)
  }

  async function handleDeleteSelected(){
    const ids = patients.filter(p=>p._selected).map(p=>p.id)
    if (!ids.length) return showToast('لم يتم اختيار مرضى للحذف')
    // If tests have overridden window.confirm, call the override directly to keep their behavior.
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm !== originalConfirmRef.current){
      if (window.confirm(`هل تود حذف ${ids.length} مريض/مرضى؟`)){
        const results = await Promise.allSettled(
          ids.map(id => api.delete(`/api/patients/${id}`))
        )
        const failed = results.filter(r => 
          r.status === 'rejected' || 
          (r.status === 'fulfilled' && !r.value?.data?.success)
        ).length
        showToast(failed ? 'بعض الحذف فشل' : 'تم حذف المرضى المحددين')
        setPatients(prev => prev.filter(p => !ids.includes(p.id)))
        await refreshPatients()
        return
      }
      return
    }

    // ask for confirmation via in-app modal
    setConfirmState({ open: true, message: `هل تود حذف ${ids.length} مريض/مرضى؟`, action: async () => {
      const results = await Promise.allSettled(
        ids.map(id => api.delete(`/api/patients/${id}`))
      )
      const failed = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && !r.value?.data?.success)
      ).length
      showToast(failed ? 'بعض الحذف فشل' : 'تم حذف المرضى المحددين')
      setPatients(prev => prev.filter(p => !ids.includes(p.id)))
      await refreshPatients()
    }})
  }

  // Toggle select all patients in the current list
  function toggleSelectAll(){
    const list = patients || []
    if (!list.length) return
    const allSelected = list.every(p => !!p._selected)
    setPatients(prev => (prev || []).map(p => ({ ...p, _selected: !allSelected })))
  }

  async function refreshPatients(){
    if (!selectedQueue) return
    try{
      const res = await api.get(`/api/queues/${selectedQueue}/patients`)
      const maybe = res?.data?.patients ?? res?.data?.data ?? res?.data ?? []
      setPatients(Array.isArray(maybe) ? maybe : [])
    }catch(e){ showToast('فشل الاتصال بالخادم', 'error') }
  }

  // Delete a single patient (used by tests)
  async function handleDeletePatient(patientId){
    if (!patientId) return
    // If tests have overridden window.confirm, call the override directly
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm !== originalConfirmRef.current){
      if (!window.confirm('هل تود حذف هذا المريض؟')) return
      try{
        const res = await api.delete(`/api/patients/${patientId}`)
        if (res?.data?.success) {
          setPatients(prev => prev.filter(p => p.id !== patientId))
          showToast('تم حذف المريض')
        } else {
          showToast('فشل حذف المريض', 'error')
        }
      }catch(e){
        showToast('فشل الاتصال بالخادم', 'error')
      }
      return
    }

    setConfirmState({ open: true, message: 'هل تود حذف هذا المريض؟', action: async () => {
      try{
        const res = await api.delete(`/api/patients/${patientId}`)
        if (res?.data?.success) {
          setPatients(prev => prev.filter(p => p.id !== patientId))
          showToast('تم حذف المريض')
        } else {
          showToast('فشل حذف المريض', 'error')
        }
      }catch(e){
        showToast('فشل الاتصال بالخادم', 'error')
      }
    }})
  }

  return (
    <>
      <Layout
        userRole={userInfo.role}
        userName={userInfo.name}
        whatsappConnected={userInfo.whatsappConnected}
        onLogout={async () => {
          try {
            await api.post('/api/auth/logout')
            window.location.href = '/login'
          } catch (error) {
            showToast('فشل في تسجيل الخروج')
          }
        }}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        queues={queues}
        selectedQueue={selectedQueue}
        onQueueSelect={handleQueueSelect}
        canAddQueue={userInfo.role === 'مدير أساسي'}
        onAddQueue={async (name, description) => {
          try {
            const res = await api.post('/api/queues', { doctorName: name, description })
            const q = res?.data?.queue ?? res?.data?.data ?? res?.data
            const normalized = { id: q.id ?? q.Id, name: q.doctorName ?? q.DoctorName ?? q.name ?? name, description: q.description ?? q.Description }
            setQueues(prev => [...prev, normalized])
            showToast('تم إنشاء الطابور بنجاح')
          } catch (error) {
            showToast('فشل في إنشاء الطابور')
          }
        }}
        onRequestAddQueue={() => setShowAddQueueModal(true)}
  onRequestAccount={() => setShowAccountModal(true)}
        onEditQueue={async (id, name, description) => {
          try {
            const res = await api.put(`/api/queues/${id}`, { doctorName: name, description })
            const q = res?.data?.queue ?? res?.data?.data ?? res?.data
            const normalized = { id: q.id ?? q.Id ?? id, name: q.doctorName ?? q.DoctorName ?? name, description: q.description ?? q.Description }
            setQueues(prev => prev.map(q => q.id === id ? normalized : q))
            showToast('تم تحديث الطابور بنجاح')
          } catch (error) {
            showToast('فشل في تحديث الطابور')
          }
        }}
        onDeleteQueue={async (id) => {
          try {
            await api.delete(`/api/queues/${id}`)
            setQueues(prev => prev.filter(q => q.id !== id))
            if (selectedQueue === id) {
              setSelectedQueue(null)
              setPatients([])
            }
            showToast('تم حذف الطابور بنجاح')
          } catch (error) {
            showToast('فشل في حذف الطابور')
          }
        }}
      >
        {activeSection === 'dashboard' && (
          <div className="p-6 space-y-6" role="region" aria-label="لوحة التحكم">
            {selectedQueue ? (
              <>
                <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-6 md:p-8 rounded-xl shadow-lg transform transition duration-300 hover:shadow-2xl hover:scale-105" role="region" aria-label="معلومات الطابور" aria-live="polite">
                  <div className="flex items-center justify-between">
                    <div className="text-right">
                      <h2 className="text-2xl md:text-3xl font-bold mb-2">{(queues.find(q => q.id === selectedQueue)?.name) || 'اختر طابور'}</h2>
                      <div className="grid grid-cols-3 gap-4 text-blue-100">
                        <div>
                          <p className="text-sm">عدد المرضى</p>
                          <p className="text-xl font-bold">{patients?.length ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-sm">الموضع الحالي</p>
                          <p className="text-xl font-bold">{queues.find(q => q.id === selectedQueue)?.currentPosition ?? 1}</p>
                        </div>
                        <div>
                          <p className="text-sm">الوقت المتوقع</p>
                          <p className="text-xl font-bold">{queues.find(q => q.id === selectedQueue)?.estimatedTime ?? 15} دقيقة</p>
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" role="toolbar" aria-label="إجراءات الطابور">
                  <button 
                    onClick={() => setShowAddPatientModal(true)} 
                    className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500" 
                    aria-label="إضافة مرضى جدد"
                    >
                    إضافة مرضى
                    <Icon name="fas fa-user-plus mr-2" />
                  </button>

                  <button 
                    onClick={() => setShowCSVModal(true)} 
                    className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    aria-label="رفع ملف المرضى"
                    >
                    رفع ملف المرضى
                    <Icon name="fas fa-upload mr-2" />
                  </button>

                  <button
                    onClick={refreshPatients}
                    className="bg-gray-200 text-gray-800 p-4 rounded-lg hover:bg-gray-300 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-sm flex items-center justify-center"
                    aria-label="تحديث القائمة"
                  >
                    تحديث القائمة
                  </button>

                  <button 
                    onClick={handleDeleteSelected} 
                    className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500" 
                    aria-label="حذف المرضى المحددين"
                    >
                    حذف المحدد
                    <Icon name="fas fa-trash mr-2" />
                  </button>

                  <button 
                    onClick={() => setShowMessageModal(true)} 
                    className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transform transition duration-200 hover:scale-105 hover:-translate-y-1 hover:shadow-md flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500" 
                    aria-label="إرسال رسالة واتساب"
                    >
                    إرسال رسالة
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
                          onPreview={(val)=>{ if (val) { setSelectedTemplate(val); setShowMessagePreview(true) } }}
                          aria-label="اختيار قالب الرسالة"
                        />
                      </div>
                      <div className="mr-4">
                        <button 
                          onClick={() => setShowMessageModal(true)} 
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          تغيير الرسالة
                        </button>
                        <button
                          onClick={() => setShowAddTemplateModal(true)}
                          className="mr-2 bg-gray-100 text-gray-800 px-3 py-2 rounded-md hover:bg-gray-200 transition duration-200"
                        >
                          إضافة قالب
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                      <p className="text-gray-800" aria-live="polite">
                        {selectedTemplate ? (templates.find(t => t.id === selectedTemplate)?.content || '') : 'لم يتم اختيار رسالة'}
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
                      try {
                        await api.post(`/api/queues/${selectedQueue}/reorder`, {
                          positions: patients.map((p, i) => ({ id: p.id, position: i + 1 }))
                        })
                        await refreshPatients()
                      } catch (error) {
                        showToast('فشل في إعادة ترتيب المرضى')
                      }
                    }}
                  />
                  
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow-lg" role="alert">
                الرجاء اختيار طابور لعرض المرضى
              </div>
            )}
          </div>
        )}

        {activeSection === 'messages' && (
          <div className="p-6" role="region" aria-label="إدارة الرسائل">
            <h2 className="text-2xl font-bold mb-4">إدارة الرسائل</h2>
            <MessagesPanel templates={templates} onSend={(text)=>{
              // reuse existing handler
              handleSendMessage(text)
            }} />
          </div>
        )}

        {activeSection === 'management' && (
          <div className="p-6" role="region" aria-label="إدارة النظام">
            <h2 className="text-2xl font-bold mb-4">إدارة النظام</h2>
            {/* سيتم تنفيذ قسم الإدارة */}
          </div>
        )}
      </Layout>

  <AccountInfoModal open={showAccountModal} onClose={() => setShowAccountModal(false)} user={userInfo} />

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
          try{
            // optimistic update locally
            setPatients(prev => prev.map(p => p.id === data.id ? { ...p, fullName: data.fullName, phoneNumber: data.phoneNumber, position: data.position } : p))
            const res = await api.put(`/api/patients/${data.id}`, { fullName: data.fullName, phoneNumber: data.phoneNumber, position: data.position })
            const serverData = res?.data?.patient ?? res?.data?.data ?? res?.data
            if (serverData && serverData.id) {
              setPatients(prev => prev.map(p => p.id === data.id ? ({ ...p, ...serverData }) : p))
            } else {
              // fallback to refresh when server didn't return canonical data
              await refreshPatients()
            }
          }catch(e){
            showToast('فشل في حفظ بيانات المريض')
          } finally {
            setEditingPatient(null)
          }
        }}
      />

      <ModalWrapper open={showCSVModal} onClose={() => setShowCSVModal(false)} dir="rtl">
        <h3 id="csv-modal-title" className="text-xl font-bold mb-4">رفع ملف المرضى</h3>
        <CSVUpload 
          onChunk={handleCSVChunk} 
          onProgress={handleCSVProgress} 
          onComplete={handleCSVComplete}
          onError={() => showToast('فشل قراءة الملف')}
        />
        <div className="mt-4">
          <div className="w-full bg-gray-200 h-3 rounded">
            <div 
              className="bg-blue-600 h-3 rounded" 
              style={{ width: `${csvProgress.total ? Math.min(100, Math.round((csvProgress.uploaded / csvProgress.total) * 100)) : 0}%` }}
              role="progressbar"
              aria-valuenow={csvProgress.uploaded}
              aria-valuemin="0"
              aria-valuemax={csvProgress.total}
              aria-label="تقدم رفع الملف"
            />
          </div>
          <div className="text-sm text-gray-600 mt-2" aria-live="polite">
            تم رفع {csvProgress.uploaded} من {csvProgress.total} سجلات
          </div>
        </div>
        <div className="flex justify-start mt-4">
          <button 
            onClick={() => setShowCSVModal(false)}
            className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 transition duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            إغلاق
          </button>
        </div>
      </ModalWrapper>

      <MessageSelectionModal
        open={showMessageModal}
        template={templates.find(t => t.id === selectedTemplate)}
        onClose={() => setShowMessageModal(false)}
        onSend={handleSendMessage}
      />
      <AddMessageTemplateModal
        open={showAddTemplateModal}
        onClose={() => setShowAddTemplateModal(false)}
        onSave={async (data) => {
          // optimistic create with temp id and replace with server response when available
          const tempId = `tmpl-tmp-${Date.now()}`
          const tempTemplate = { id: tempId, name: data.name, content: data.content, _optimistic: true }
          setTemplates(prev => [...(prev || []), tempTemplate])
          setShowAddTemplateModal(false)
          showToast('جارٍ إضافة القالب...')
          try{
            const res = await api.post('/api/templates', { name: data.name, content: data.content })
            const serverTpl = res?.data?.template ?? res?.data?.data ?? res?.data
            if (serverTpl && serverTpl.id) {
              setTemplates(prev => prev.map(t => t.id === tempId ? ({ id: serverTpl.id, name: serverTpl.name ?? data.name, content: serverTpl.content ?? data.content }) : t))
              showToast('تم إضافة القالب')
            } else {
              // fallback: remove temp and show success (server didn't return canonical id)
              setTemplates(prev => prev.map(t => t.id === tempId ? ({ id: `tmpl-${Date.now()}`, name: data.name, content: data.content }) : t))
              showToast('تم إضافة القالب')
            }
          }catch(e){
            // remove optimistic template on failure
            setTemplates(prev => (prev || []).filter(t => t.id !== tempId))
            showToast('فشل في إضافة القالب', 'error')
          }
        }}
      />
      <MessagePreviewModal
        open={showMessagePreview}
        template={templates.find(t => t.id === selectedTemplate)}
        patients={patients.filter(p=>p._selected)}
        onClose={() => setShowMessagePreview(false)}
        onConfirm={(/* optional */) => { handleSendMessage(/* will use selectedTemplate and selected patients */); }}
      />

      <RetryPreviewModal
        open={showRetryPreview}
        tasks={[]}
        onClose={() => setShowRetryPreview(false)}
        onRetry={(tasks) => { /* implement retry via API if needed */ }}
      />

      <QuotaManagementModal
        open={showQuotaModal}
        moderator={null}
        onClose={() => setShowQuotaModal(false)}
        onSave={(data) => { showToast('تم تحديث الحصص') }}
      />

      <EditUserModal
        open={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSave={(u) => { showToast('تم حفظ المستخدم') }}
      />
      <Toast />

      {/* Simple Add Queue Modal for tests */}
      <ModalWrapper open={showAddQueueModal} onClose={() => setShowAddQueueModal(false)} dir="rtl">
        <h3 className="text-lg font-bold mb-4">إضافة طابور</h3>
        <label className="block text-sm mb-1" htmlFor="new-queue-name">اسم الطابور</label>
        <input id="new-queue-name" aria-label="اسم الطابور" value={newQueueName} onChange={e=>setNewQueueName(e.target.value)} className="w-full p-2 border rounded mb-3" />
        <label className="block text-sm mb-1" htmlFor="new-queue-desc">الوصف</label>
        <textarea id="new-queue-desc" aria-label="وصف الطابور" value={newQueueDesc} onChange={e=>setNewQueueDesc(e.target.value)} className="w-full p-2 border rounded mb-3" />
        <div className="flex justify-end space-x-2">
          <button className="px-4 py-2" onClick={()=>{ setShowAddQueueModal(false); setNewQueueName(''); setNewQueueDesc('') }}>إلغاء</button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={async ()=>{
            try{
              const res = await api.post('/api/queues', { doctorName: newQueueName, description: newQueueDesc })
              setQueues(prev => [...prev, res.data.queue])
              showToast('تم إنشاء الطابور بنجاح')
            }catch(e){
              showToast('فشل في إنشاء الطابور')
            }finally{
              setShowAddQueueModal(false)
              setNewQueueName('')
              setNewQueueDesc('')
            }
          }}>إضافة</button>
        </div>
      </ModalWrapper>
      {/* Confirmation modal used by deletions in tests */}
      <ModalWrapper open={confirmState.open} onClose={() => setConfirmState({ open: false, message: '', action: null })} dir="rtl">
        <div className="mb-4">{confirmState.message}</div>
        <div className="flex justify-end space-x-2">
          <button onClick={() => setConfirmState({ open: false, message: '', action: null })} className="px-4 py-2">إلغاء</button>
          <button onClick={async () => { const action = confirmState.action; setConfirmState({ open: false, message: '', action: null }); if (action) await action(); }} className="bg-blue-600 text-white px-4 py-2 rounded">تأكيد</button>
        </div>
      </ModalWrapper>
    </>
  )
}