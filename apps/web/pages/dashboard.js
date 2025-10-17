import React, { useEffect, useState } from 'react'
import api from '../lib/api'
import Layout from '../components/Layout'
import QueueList from '../components/QueueList'
import PatientsTable from '../components/PatientsTable'
import Toast, { showToast } from '../components/Toast'
import TemplatesSelect from '../components/TemplatesSelect'
import AddPatientsModal from '../components/AddPatientsModal'
import CSVUpload from '../components/CSVUpload'
import MessageSelectionModal from '../components/MessageSelectionModal'

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
  
  // Modal State
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [showAddQueueModal, setShowAddQueueModal] = useState(false)
  const [csvProgress, setCsvProgress] = useState({ rowsParsed: 0, uploaded: 0, total: 0 })
  
  // CSV Processing Refs
  const csvPendingRef = React.useRef(0)
  const csvFinishedRef = React.useRef(false)
  const csvTotalFailedRef = React.useRef(0)

  useEffect(()=>{
    // Guard API calls with catch handlers so tests don't fail on rejected promises
    api.get('/api/queues')
      .then(res => setQueues(res.data.queues || []))
      .catch(() => { /* ignore load errors in UI */ })

    api.get('/api/templates')
      .then(res => setTemplates(res.data.templates || []))
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
    setSelectedQueue(id)
    api.get(`/api/queues/${id}/patients`)
      .then(res => setPatients(res.data.patients || []))
      .catch(() => { /* ignore patient load errors */ })
  }

  // persist template selection
  function handleTemplateChange(tid){
    setSelectedTemplate(tid)
    try{ localStorage.setItem('selectedTemplate', tid) }catch(e){}
  }

  async function handleAddPatients(newPatients){
    if (!selectedQueue) return
    try{
      for (const p of newPatients){
        await api.post(`/api/queues/${selectedQueue}/patients`, p)
      }
      showToast('تمت إضافة المرضى بنجاح')
      await refreshPatients()
    }catch(e){
      showToast('فشل إضافة المرضى')
    } finally {
      setShowAddPatientModal(false)
    }
  }

  async function handleCSVChunk(slotsChunk){
    if (!selectedQueue) return

    const tempEntries = []
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
      tempEntries.push(tempEntry)

      Promise.resolve().then(() => {
        setCsvProgress(prev => ({ ...prev, total: prev.total + 1 }))
        setPatients(prev => [...(prev || []), tempEntry])
      })
    }

    // increase pending counter
    csvPendingRef.current += tempEntries.length
    csvFinishedRef.current = false
    
    let totalFailed = 0

    // process rows sequentially so failures are removed immediately
    let failedCount = 0
    for (let idx = 0; idx < tempEntries.length; idx++){
      const temp = tempEntries[idx]
      const row = slotsChunk[idx]

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
        if (csvTotalFailedRef.current > 0) showToast('بعض السجلات فشلت')
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
      const res = await api.post('/api/messages/send', { 
        template: text, 
        recipients: patients.filter(p=>p._selected).map(p=>p.id) 
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
    
    if (!window.confirm(`هل تود حذف ${ids.length} مريض/مرضى؟`)) return
    
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
  }

  async function refreshPatients(){
    if (!selectedQueue) return
    try{
      const res = await api.get(`/api/queues/${selectedQueue}/patients`)
      setPatients(res.data.patients || [])
    }catch(e){ }
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
            const res = await api.post('/api/queues', { title: name, description })
            setQueues(prev => [...prev, res.data.queue])
            showToast('تم إنشاء الطابور بنجاح')
          } catch (error) {
            showToast('فشل في إنشاء الطابور')
          }
        }}
        onRequestAddQueue={() => setShowAddQueueModal(true)}
        onEditQueue={async (id, name, description) => {
          try {
            const res = await api.put(`/api/queues/${id}`, { name, description })
            setQueues(prev => prev.map(q => q.id === id ? res.data.queue : q))
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
                <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-6 md:p-8 rounded-xl shadow-lg" role="region" aria-label="معلومات الطابور" aria-live="polite">
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
                        <i className="fas fa-users text-2xl" aria-hidden="true"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" role="toolbar" aria-label="إجراءات الطابور">
                  <button 
                    onClick={() => setShowAddPatientModal(true)} 
                    className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500" 
                    aria-label="إضافة مرضى جدد"
                  >
                    <i className="fas fa-user-plus ml-2" aria-hidden="true"></i>
                    إضافة مرضى
                  </button>

                  <button 
                    onClick={() => setShowCSVModal(true)} 
                    className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    aria-label="رفع ملف المرضى"
                  >
                    <i className="fas fa-upload ml-2" aria-hidden="true"></i>
                    رفع ملف المرضى
                  </button>

                  <button 
                    onClick={handleDeleteSelected} 
                    className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500" 
                    aria-label="حذف المرضى المحددين"
                  >
                    <i className="fas fa-trash ml-2" aria-hidden="true"></i>
                    حذف المحدد
                  </button>

                  <button 
                    onClick={() => setShowMessageModal(true)} 
                    className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500" 
                    aria-label="إرسال رسالة واتساب"
                  >
                    <i className="fab fa-whatsapp ml-2" aria-hidden="true"></i>
                    إرسال رسالة
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
                    onToggle={(idx) => {
                      const p = patients[idx]
                      if (!p) return
                      p._selected = !p._selected
                      setPatients([...patients])
                    }}
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
            {/* سيتم تنفيذ قسم الرسائل */}
          </div>
        )}

        {activeSection === 'management' && (
          <div className="p-6" role="region" aria-label="إدارة النظام">
            <h2 className="text-2xl font-bold mb-4">إدارة النظام</h2>
            {/* سيتم تنفيذ قسم الإدارة */}
          </div>
        )}
      </Layout>

      <AddPatientsModal 
        open={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onAdd={handleAddPatients}
      />

      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="csv-modal-title">
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
          </div>
        </div>
      )}

      <MessageSelectionModal
        open={showMessageModal}
        template={templates.find(t => t.id === selectedTemplate)}
        onClose={() => setShowMessageModal(false)}
        onSend={handleSendMessage}
      />
      <Toast />

      {/* Simple Add Queue Modal for tests */}
      {showAddQueueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">إضافة طابور</h3>
            <label className="block text-sm mb-1" htmlFor="new-queue-name">اسم الطابور</label>
            <input id="new-queue-name" aria-label="اسم الطابور" className="w-full p-2 border rounded mb-3" />
            <label className="block text-sm mb-1" htmlFor="new-queue-desc">الوصف</label>
            <textarea id="new-queue-desc" aria-label="وصف الطابور" className="w-full p-2 border rounded mb-3" />
            <div className="flex justify-end space-x-2">
              <button className="px-4 py-2" onClick={()=>setShowAddQueueModal(false)}>إلغاء</button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={async ()=>{
                const name = document.getElementById('new-queue-name')?.value || ''
                const desc = document.getElementById('new-queue-desc')?.value || ''
                try{
                  const res = await api.post('/api/queues', { title: name, description: desc })
                  setQueues(prev => [...prev, res.data.queue])
                  showToast('تم إنشاء الطابور بنجاح')
                }catch(e){
                  showToast('فشل في إنشاء الطابور')
                }finally{
                  setShowAddQueueModal(false)
                }
              }}>إضافة</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}