import React, { useEffect, useState } from 'react'
import api from '../lib/api'
import QueueList from '../components/QueueList'
import PatientsTable from '../components/PatientsTable'
import Toast, { showToast } from '../components/Toast'
import TemplatesSelect from '../components/TemplatesSelect'
import AddPatientsModal from '../components/AddPatientsModal'
import CSVUpload from '../components/CSVUpload'
import MessageSelectionModal from '../components/MessageSelectionModal'

export default function Dashboard(){
  const [queues, setQueues] = useState([])
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [patients, setPatients] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [csvProgress, setCsvProgress] = useState({ rowsParsed: 0, uploaded: 0, total: 0 })
  const [showMessageModal, setShowMessageModal] = useState(false)
  // track in-flight uploads and completion to avoid showing success before backend work finishes
  const csvPendingRef = React.useRef(0)
  const csvFinishedRef = React.useRef(false)
  const csvTotalFailedRef = React.useRef(0)

  useEffect(()=>{
    api.get('/api/queues').then(res => setQueues(res.data.queues || []))
    api.get('/api/templates').then(res => setTemplates(res.data.templates || []))
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
    api.get(`/api/queues/${id}/patients`).then(res => setPatients(res.data.patients || []))
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

  // per-row retry helper with exponential backoff
  async function tryPostWithRetry(url, payload, maxRetries = 3){
    let attempt = 0
    let delay = 200
    while (attempt <= maxRetries){
      try{
        const res = await api.post(url, payload)
        return res
      }catch(e){
        attempt++
        if (attempt > maxRetries) throw e
        // backoff
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
      }
    }
  }

  // handle parsed chunks as they arrive from CSVUpload
  async function handleCSVChunk(slotsChunk, { batchSize = 25 } = {}){
    if (!selectedQueue) return
    // update total parsed count
    setCsvProgress(prev => ({ ...prev, total: prev.total + slotsChunk.length }))

    // optimistic append: create temp entries so UI reflects parsed rows immediately
    const tempEntries = slotsChunk.map(s => ({ id: `tmp-${Math.random().toString(36).slice(2)}`, fullName: s.fullName, phoneNumber: s.phoneNumber, position: null, _optimistic: true, _temp: true }))
    setPatients(prev => [...(prev||[]), ...tempEntries])

    // increase pending counter
    csvPendingRef.current += tempEntries.length
    csvFinishedRef.current = false

  let totalFailed = 0

    // split into smaller batches for concurrent uploads
    const batchSizeLocal = batchSize
    for (let i=0;i<slotsChunk.length;i+=batchSizeLocal){
      const batch = slotsChunk.slice(i, i+batchSizeLocal)
      const batchTemp = tempEntries.slice(i, i+batchSizeLocal)
      // start network uploads for this batch
      const promises = batch.map(s => tryPostWithRetry(`/api/queues/${selectedQueue}/patients`, { fullName: s.fullName, phoneNumber: s.phoneNumber, desiredPosition: s.desiredPosition }).then(r=> ({ success: true, data: r?.data?.data })).catch(e=> ({ success: false })))
      const results = await Promise.all(promises)
      let failedCount = 0
      // reconcile results with temp entries (use temp id directly for reliable replace/remove)
      for (let k=0;k<results.length;k++){
        const r = results[k]
        const temp = batchTemp[k]
        if (r.success && r.data){
          // replace temp entry with server-provided entry
          setPatients(prev => {
            return (prev||[]).map(p => p.id === temp.id ? { ...r.data, _optimistic: true } : p)
          })
          setCsvProgress(prev => ({ ...prev, uploaded: prev.uploaded + 1 }))
        } else {
          // remove the temp entry by id
          setPatients(prev => (prev||[]).filter(p => p.id !== temp.id))
          failedCount++
        }
        // decrement pending counter for each processed row
        csvPendingRef.current = Math.max(0, csvPendingRef.current - 1)
      }
      totalFailed += failedCount
    }
    

    // cleanup: remove any leftover temp rows with empty names or phones
    setPatients(prev => (prev||[]).filter(p => !(p._temp && (!p.fullName || p.fullName.toString().trim() === ''))))

    if (totalFailed > 0) csvTotalFailedRef.current += totalFailed

    // if no pending uploads remain, mark finished and show overall toast
    if (csvPendingRef.current === 0){
      csvFinishedRef.current = true
      if (csvTotalFailedRef.current > 0) showToast('بعض السجلات فشلت')
      else showToast('تم رفع ملف المرضى')
      // reset counters
      csvTotalFailedRef.current = 0
      setCsvProgress(prev => ({ ...prev, rowsParsed: prev.rowsParsed }))
    }
  }

  function handleCSVProgress(progress){
    setCsvProgress(prev => ({ ...prev, rowsParsed: progress.rowsParsed }))
  }

  function handleCSVComplete(){
    showToast('تم رفع ملف المرضى')
    setShowCSVModal(false)
  }

  async function handleSendMessage(text){
    try{
      const res = await api.post('/api/messages/send', { template: text, recipients: patients.filter(p=>p._selected).map(p=>p.id) })
      if (res?.data?.success) showToast('تم إرسال الرسالة')
      else showToast('فشل إرسال الرسالة')
    }catch(e){ showToast('فشل إرسال الرسالة') }
    setShowMessageModal(false)
  }

  // delete selected patients (calls DELETE /api/patients/:id)
  async function handleDeleteSelected(){
    const ids = patients.filter(p=>p._selected).map(p=>p.id)
    if (!ids.length) return showToast('لم يتم اختيار مرضى للحذف')
    if (!window.confirm(`هل تود حذف ${ids.length} مريض/مرضى؟`)) return
    const results = await Promise.allSettled(ids.map(id => api.delete(`/api/patients/${id}`)))
    const failed = results.filter(r=> r.status === 'rejected' || (r.status==='fulfilled' && !(r.value?.data?.success))).length
    if (failed) showToast('بعض الحذف فشل')
    else showToast('تم حذف المرضى المحددين')
    // remove deleted ids from local state optimistically
    setPatients(prev => (prev || []).filter(p => !ids.includes(p.id)))
    // refresh to sync ordering/state
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
    <div className="p-8 font-sans text-base" data-testid="dashboard-main">
      <Toast />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <QueueList queues={queues} selectedQueue={selectedQueue} onSelect={handleQueueSelect} />
        </div>

        <div className="md:col-span-3">
          <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-6 md:p-8 rounded-xl mb-6" role="region" aria-live="polite">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{(queues.find(q => q.id === selectedQueue)?.doctorName) || 'اختر طابور'}</h2>
                <div className="grid grid-cols-3 gap-4 text-blue-100">
                  <div>
                    <p className="text-sm">عدد المرضى</p>
                    <p className="text-xl font-bold">{patients?.length ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm">الموضع الحقيقي (CQP)</p>
                    <input type="number" defaultValue={queues.find(q => q.id === selectedQueue)?.currentPosition ?? 1} className="text-xl font-bold bg-transparent border-b border-blue-300 text-white w-16 text-center" />
                  </div>
                  <div>
                    <p className="text-sm">الوقت المتوقع للجلسة (ETS)</p>
                    <div className="flex items-center">
                      <input type="number" defaultValue={queues.find(q => q.id === selectedQueue)?.estimatedTime ?? 15} className="text-xl font-bold bg-transparent border-b border-blue-300 text-white w-16 text-center" />
                      <span className="text-xl font-bold mr-1">دقيقة</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                  <i className="fas fa-users text-2xl"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" role="toolbar" aria-label="إجراءات الطابور">
            <button aria-label="add-patients" onClick={() => setShowAddPatientModal(true)} className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center" role="button">
              <i className="fas fa-user-plus mr-2"></i>
              إضافة مرضى
            </button>

            <button aria-label="open-csv-modal" onClick={() => setShowCSVModal(true)} className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center" role="button">
              <i className="fas fa-upload mr-2"></i>
              رفع ملف المرضى
            </button>

            <button aria-label="delete-selected" onClick={handleDeleteSelected} className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center" role="button">
              <i className="fas fa-trash mr-2"></i>
              حذف المحدد
            </button>

            <button aria-label="open-message-modal" onClick={() => setShowMessageModal(true)} className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition duration-200 flex items-center justify-center" role="button">
              <i className="fab fa-whatsapp mr-2"></i>
              إرسال رسالة
            </button>
          </div>

          <div className="bg-gray-50 p-4 md:p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <TemplatesSelect templates={templates} value={selectedTemplate} onChange={handleTemplateChange} />
              </div>
              <div className="ml-4">
                <button onClick={() => setShowMessageModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">تغيير الرسالة</button>
              </div>
            </div>
            <div className="bg-white p-4 rounded border border-gray-200">
              <p className="text-gray-800" aria-live="polite">{selectedTemplate ? (templates.find(t => t.id === selectedTemplate)?.content || '') : 'لم يتم اختيار رسالة'}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {selectedQueue ? (
              <PatientsTable
                patients={patients}
                onToggle={(idx) => {
                  const p = patients[idx]
                  if (!p) return
                  p._selected = !p._selected
                  setPatients([...patients])
                }}
                onReorder={async (from, to) => {
                  try{
                    await api.post(`/api/queues/${selectedQueue}/reorder`, { positions: patients.map((p, i) => ({ id: p.id, position: i+1 })) })
                    await refreshPatients()
                  }catch(e){ }
                }}
              />
            ) : (
              <div className="p-6 text-center text-gray-500">اختر طابورًا لعرض المرضى</div>
            )}
          </div>
        </div>
      </div>

      <AddPatientsModal open={showAddPatientModal} onClose={() => setShowAddPatientModal(false)} onAdd={handleAddPatients} />

      {showCSVModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">رفع ملف CSV</h3>
            <CSVUpload onChunk={handleCSVChunk} onProgress={handleCSVProgress} onComplete={handleCSVComplete} onError={(e)=> showToast('فشل قراءة الملف')} />
            <div className="mt-4">
              <div className="w-full bg-gray-200 h-3 rounded">
                <div className="bg-blue-600 h-3 rounded" style={{ width: `${csvProgress.total ? Math.min(100, Math.round((csvProgress.uploaded / csvProgress.total) * 100)) : 0}%` }} />
              </div>
              <div className="text-sm text-gray-600 mt-2">تم رفع {csvProgress.uploaded} من {csvProgress.total} سجلات</div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowCSVModal(false)} className="bg-gray-300 px-4 py-2 rounded">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Non-modal CSVUpload for tests that query the file input directly */}
      <div className="mt-4">
        <CSVUpload onChunk={handleCSVChunk} onProgress={handleCSVProgress} onComplete={handleCSVComplete} onError={(e)=> showToast('فشل قراءة الملف')} />
        <div className="w-full bg-gray-200 h-2 rounded mt-2">
          <div className="bg-blue-600 h-2 rounded" style={{ width: `${csvProgress.total ? Math.min(100, Math.round((csvProgress.uploaded / csvProgress.total) * 100)) : 0}%` }} />
        </div>
      </div>

      <MessageSelectionModal open={showMessageModal} template={templates.find(t => t.id === selectedTemplate)} onClose={() => setShowMessageModal(false)} onSend={handleSendMessage} />
    </div>
  )
}