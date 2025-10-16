import {useEffect, useState} from 'react'
import api from '../lib/api'
import QueueList from '../components/QueueList'
import PatientsTable from '../components/PatientsTable'
import TemplatesSelect from '../components/TemplatesSelect'
import AddPatientsModal from '../components/AddPatientsModal'
import Toast, { showToast } from '../components/Toast'

export default function Dashboard(){
  const [queues, setQueues] = useState([])
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [patients, setPatients] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [loadingQueues, setLoadingQueues] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(()=>{
    try { const u = JSON.parse(localStorage.getItem('currentUser')) ; setCurrentUser(u) } catch(e){}
    setLoadingQueues(true)
    api.get('/api/queues').then(r=> setQueues(r.data.data || [])).catch(()=>{}).finally(()=>setLoadingQueues(false))
    api.get('/api/templates').then(r=> { setTemplates(r.data.data || []); if(r.data.data && r.data.data.length) setSelectedTemplate(r.data.data[0].id) }).catch(()=>{})
  },[])

  useEffect(()=>{
    if (!selectedQueue) return setPatients([])
    setLoadingPatients(true)
    api.get(`/api/queues/${selectedQueue}/patients`).then(r=> {
      const list = (r.data.data || []).map(p=>({...p, _selected:false}))
      // order by Position ascending (server maintains positions); stable for insertion
      list.sort((a,b)=> (a.position||0) - (b.position||0))
      setPatients(list)
    })
      .catch(()=>{})
      .finally(()=>setLoadingPatients(false))
  },[selectedQueue])

  async function sendToSelected() {
    const ids = patients.filter(p => p._selected).map(p=>p.id)
    if (!ids.length) return alert('اختر مرضى أولا')
    try {
      const res = await api.post('/api/messages/send', { templateId: selectedTemplate, patientIds: ids, channel: 'whatsapp' })
      alert('تم جدولة ' + (res.data?.queued || 0) + ' رسالة')
    } catch (e) { alert('فشل الإرسال') }
  }

  // messages panel: send with override content
  async function sendWithOverride(overrideContent) {
    const ids = patients.filter(p => p._selected).map(p=>p.id)
    if (!ids.length) return alert('اختر مرضى أولا')
    try {
      const res = await api.post('/api/messages/send', { templateId: selectedTemplate, patientIds: ids, overrideContent, channel: 'whatsapp' })
      alert('تم جدولة ' + (res.data?.queued || 0) + ' رسالة')
    } catch (e) { alert('فشل الإرسال') }
  }

  function togglePatient(i){
    setPatients(ps => ps.map((p,idx)=> idx===i ? {...p, _selected: !p._selected} : p))
  }

  // batch-add patients with optimistic UI
  async function handleAddPatients(slots){
    if (!selectedQueue) return alert('اختر طابور أولاً')
    // optimistic insertion: compute local positions when desiredPosition provided
    const now = Date.now()
    const current = [...patients]
    // clone and sort by position
    current.sort((a,b)=> (a.position||0) - (b.position||0))
    // Build optimistic list by applying shifts per slot
    const optimisticInsertions = []
    for (let i=0;i<slots.length;i++){
      const s = slots[i]
      const desired = s.desiredPosition ? parseInt(s.desiredPosition,10) : null
      let insertPos = desired && desired > 0 ? desired : (current.length ? Math.max(...current.map(p=>p.position||0)) + 1 : 1)
      // shift existing
      current.forEach(p=>{ if ((p.position||0) >= insertPos) p.position = (p.position||0) + 1 })
      const temp = { id: `tmp-${now}-${i}`, fullName: s.fullName, phoneNumber: s.phoneNumber, position: insertPos, _optimistic: true }
      optimisticInsertions.push(temp)
      current.push(temp)
    }
    // sort for display
    current.sort((a,b)=> (a.position||0) - (b.position||0))
    setPatients(current.map(p=> ({ ...p, _selected:false })))

    try {
      // send requests in batch, preserving desiredPosition where present
      for (const s of slots){
        await api.post(`/api/queues/${selectedQueue}/patients`, { fullName: s.fullName, phoneNumber: s.phoneNumber, desiredPosition: s.desiredPosition ? parseInt(s.desiredPosition,10) : undefined })
      }
      // refresh list
      const r = await api.get(`/api/queues/${selectedQueue}/patients`)
      setPatients((r.data.data || []).map(p=>({...p, _selected:false})))
    } catch (e) {
      showToast('فشل إضافة بعض المرضى')
      // remove optimistic flags by reloading
      try{ const r = await api.get(`/api/queues/${selectedQueue}/patients`); setPatients((r.data.data || []).map(p=>({...p, _selected:false}))) }catch{ setPatients(ps => ps.filter(p => !p._optimistic)) }
    }
  }

  const isAdmin = currentUser?.role && ['primary_admin','secondary_admin'].includes(currentUser.role)

  const [activePanel, setActivePanel] = useState('welcome') // 'welcome' | 'messages' | 'management' | 'queue'
  const [overrideText, setOverrideText] = useState('')

  return (
    <div dir="rtl" className="p-8">
      <Toast />
      <h1 className="text-2xl mb-4">لوحة التحكم</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="col-span-1">
          {loadingQueues ? <div>جارٍ تحميل الطوابير...</div> : <QueueList queues={queues} selectedQueue={selectedQueue} onSelect={(id)=>{ setSelectedQueue(id); setActivePanel('queue') }} />}
          <div className="mt-4">
            <button onClick={()=>{ setActivePanel('messages') }} className={`w-full py-2 rounded mb-2 ${activePanel==='messages' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>الرسائل</button>
            {isAdmin && <button onClick={()=>{ setActivePanel('management') }} className={`w-full py-2 rounded ${activePanel==='management' ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>الإدارة</button>}
          </div>
        </div>

        <div className="col-span-3">
          {activePanel==='welcome' && (
            <div className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">مرحباً بك في نظام إدارة العيادات</h2>
              <p className="text-gray-600">اختر طابوراً أو افتح قسم الرسائل/الإدارة للبدء</p>
            </div>
          )}

          {activePanel==='queue' && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <TemplatesSelect templates={templates} value={selectedTemplate} onChange={setSelectedTemplate} />
                <div className="flex items-center space-x-2">
                  <button onClick={sendToSelected} className="bg-purple-600 text-white px-4 py-2 rounded">إرسال للمحدد</button>
                  <button onClick={()=>setModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded">إضافة مريض</button>
                </div>
              </div>
              {loadingPatients ? <div>جارٍ تحميل المرضى...</div> : <PatientsTable patients={patients} onToggle={togglePatient} />}
            </>
          )}

          {activePanel==='messages' && (
            <div>
              <h2 className="text-xl font-bold mb-4">إرسال رسائل</h2>
              <div className="mb-4 flex items-start gap-6">
                <div className="w-1/3"><TemplatesSelect templates={templates} value={selectedTemplate} onChange={setSelectedTemplate} /></div>
                <div className="flex-1">
                  <label className="block text-sm mb-2">معاينة / تعديل النص</label>
                  <textarea value={overrideText} onChange={e=>setOverrideText(e.target.value)} rows={6} className="w-full p-3 border rounded" placeholder="ضع نص بديل هنا (اختياري)" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={()=>sendWithOverride(overrideText||null)} className="bg-purple-600 text-white px-4 py-2 rounded">إرسال للمحدد</button>
                <button onClick={()=>{ setOverrideText('') }} className="bg-gray-200 px-4 py-2 rounded">مسح</button>
                <div className="text-sm text-gray-600">حدد مرضى من الطابور لجهة الإرسال</div>
              </div>
            </div>
          )}

          {activePanel==='management' && isAdmin && (
            <div>
              <h2 className="text-xl font-bold mb-4">إدارة النظام</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-4 border rounded">
                  <h3 className="font-medium mb-3">قوالب الرسائل</h3>
                  <TemplatesManager />
                </div>
                <div className="bg-white p-4 border rounded">
                  <h3 className="font-medium mb-3">المستخدمون</h3>
                  <UsersManager />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <AddPatientsModal open={modalOpen} onClose={()=>setModalOpen(false)} onAdd={handleAddPatients} />
    </div>
  )
}

// Management helpers (inline small components)
function TemplatesManager(){
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(()=>{ load() }, [])
  function load(){ setLoading(true); api.get('/api/templates').then(r=> setList(r.data.data || [])).catch(()=>{}).finally(()=>setLoading(false)) }

  async function create(){
    if(!title || !content) return alert('املأ العنوان والمحتوى')
    try{ await api.post('/api/templates', { title, content }); setTitle(''); setContent(''); load() }catch(e){ alert('فشل الإنشاء') }
  }

  return (
    <div>
      {loading ? <div>جارٍ التحميل...</div> : (
        <div>
          <ul className="space-y-2 mb-3">
            {list.map(t => <li key={t.id} className="border p-2 rounded">{t.title || t.content.substring(0,60)}</li>)}
          </ul>
          <div className="space-y-2">
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان" className="w-full p-2 border rounded" />
            <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="محتوى" className="w-full p-2 border rounded" />
            <div className="flex gap-2"><button onClick={create} className="bg-blue-600 text-white px-4 py-2 rounded">إنشاء</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function UsersManager(){
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [fullname, setFullname] = useState('')
  const [role, setRole] = useState('user')
  const [password, setPassword] = useState('')

  useEffect(()=> load() , [])
  function load(){ setLoading(true); api.get('/api/users').then(r=> setUsers(r.data.data || [])).catch(()=>{}).finally(()=>setLoading(false)) }

  async function create(){
    if(!username || !fullname) return showToast('املأ الحقول')
    try{
      await api.post('/api/users', { username, fullName: fullname, role, password: password || undefined });
      setUsername(''); setFullname(''); setRole('user'); setPassword('');
      load();
      showToast('تم إنشاء المستخدم')
    }catch(e){ showToast('فشل الإنشاء') }
  }

  return (
    <div>
      {loading ? <div>جارٍ التحميل...</div> : (
        <div>
          <ul className="space-y-2 mb-3">
            {users.map(u => <li key={u.id} className="border p-2 rounded">{u.fullName} ({u.username}) - {u.role}</li>)}
          </ul>
          <div className="space-y-2">
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="اسم المستخدم" className="w-full p-2 border rounded" />
            <input value={fullname} onChange={e=>setFullname(e.target.value)} placeholder="الاسم الكامل" className="w-full p-2 border rounded" />
            <select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-2 border rounded"><option value="user">user</option><option value="primary_admin">primary_admin</option><option value="secondary_admin">secondary_admin</option></select>
            <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور (اختياري)" className="w-full p-2 border rounded" />
            <div className="flex gap-2"><button onClick={create} className="bg-blue-600 text-white px-4 py-2 rounded">إنشاء مستخدم</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
