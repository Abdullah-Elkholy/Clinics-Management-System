import React, { useEffect, useState, useRef } from 'react'
import ModalWrapper from './ModalWrapper'
import api from '../lib/api'
import Icon from './Icon'
import { showToast } from './Toast'
import PasswordResetModal from './PasswordResetModal'
import i18n from '../lib/i18n'

export default function UsersModal({ open, onClose }){
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const nameRef = useRef(null)
  const searchTimer = useRef(null)

  useEffect(()=>{
    if (!open) return
    fetchUsers()
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  },[open, page, pageSize])

  const [pwResetUser, setPwResetUser] = useState(null)
  const [justResetUserId, setJustResetUserId] = useState(null)

  useEffect(()=>{
    // debounce search
    if (!open) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(()=>{ setPage(1); fetchUsers(1) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  },[query])

  function fetchUsers(p = page){
    setLoading(true)
    api.get('/api/users', { params: { q: query || undefined, page: p, pageSize } })
      .then(res => {
        const data = res?.data
        const list = data?.users ?? data?.data ?? data ?? []
        setUsers(Array.isArray(list) ? list : [])
        const tot = data?.total ?? data?.meta?.total ?? (Array.isArray(list) ? list.length : 0)
        setTotal(typeof tot === 'number' ? tot : Number(tot) || 0)
      })
    .catch(()=> showToast(i18n.t('users.loading'), 'error'))
      .finally(()=> setLoading(false))
  }

  function startCreate(){
    setEditing({ id: null, username: '', role: i18n.t('users.roleLabel') })
    setTimeout(()=> nameRef.current && nameRef.current.focus(), 10)
  }

  async function saveUser(u){
  if (!u.username || !u.role) return showToast(i18n.t('users.fillRequired'))
    try{
      if (!u.id){
        const res = await api.post('/api/users', { username: u.username, role: u.role, password: u.password || null })
        const created = res?.data?.user ?? res?.data?.data ?? res?.data
        // if server returns list-paged shape, refetch; otherwise append
  if (created && created.id) setUsers(prev => [ ...(prev||[]), created ])
  else fetchUsers(1)
  showToast(i18n.t('users.added'))
      } else {
        const res = await api.put(`/api/users/${u.id}`, { username: u.username, role: u.role })
        const updated = res?.data?.user ?? res?.data?.data ?? res?.data
  setUsers(prev => prev.map(x => x.id === u.id ? ({ ...x, ...updated }) : x))
  showToast(i18n.t('users.updated'))
      }
      setEditing(null)
    }catch(e){
      showToast(i18n.t('users.updateRoleFail'), 'error')
    }
  }

  // Inline role change: saves immediately
  async function changeRole(userId, newRole){
    const prev = users
    setUsers(u => u.map(x => x.id === userId ? ({ ...x, role: newRole }) : x))
    try{
      await api.put(`/api/users/${userId}`, { role: newRole })
      showToast(i18n.t('users.updateRoleSuccess'))
    }catch(e){
      setUsers(prev)
      showToast(i18n.t('users.updateRoleFail'), 'error')
    }
  }

  // Password reset inline
  async function resetPassword(userId, newPassword){
    try{
      // try dedicated endpoint first
      await api.post(`/api/users/${userId}/reset-password`, { password: newPassword })
  showToast(i18n.t('users.resetSuccess'))
      return true
    }catch(e){
      // fallback to generic users endpoint if server expects different shape
      try{
        await api.put(`/api/users/${userId}`, { password: newPassword })
  showToast(i18n.t('users.resetSuccess'))
        return true
      }catch(e2){
        showToast(i18n.t('users.resetFail'), 'error')
        return false
      }
    }
  }

  async function deleteUser(id){
    if (!confirm(i18n.t('users.deleteConfirm'))) return
    try{
      await api.delete(`/api/users/${id}`)
      // if paged, refetch current page
      fetchUsers()
      showToast(i18n.t('users.deleted'))
    }catch(e){
      showToast(i18n.t('users.deleteFail'), 'error')
    }
  }

  return (
    <ModalWrapper open={open} onClose={onClose} dir="rtl" labelId="users-modal-title">
      <h3 id="users-modal-title" className="text-xl font-bold mb-4">{i18n.t('users.title')}</h3>

      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <label htmlFor="users-search" className="sr-only">{i18n.t('users.searchPlaceholder')}</label>
          <input id="users-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={i18n.t('users.searchPlaceholder')} className="p-2 border rounded flex-1" />
          <button type="button" onClick={startCreate} className="px-3 py-1 bg-blue-600 text-white rounded">{i18n.t('users.add')}</button>
        </div>
        <div className="text-sm text-gray-600">{i18n.t('users.showing', { count: users.length, total })}</div>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {loading && <div className="text-sm text-gray-500">{i18n.t('users.loading')}</div>}
        {!loading && users.length === 0 && <div className="text-sm text-gray-500">{i18n.t('users.empty')}</div>}
        {users.map(u => (
          <div key={u.id} className={`p-3 rounded flex items-center justify-between ${justResetUserId === u.id ? 'bg-gray-50 border-l-4 border-green-500' : 'bg-gray-50'}`}>
            <div className="text-right flex-1">
              <div className="font-medium">{u.username}</div>
              <div className="text-xs text-gray-500 flex items-center gap-3">
                <div>
                  <label htmlFor={`role-${u.id}`} className="sr-only">{i18n.t('users.roleLabel')}</label>
                  <span>{i18n.t('users.roleLabel')}:</span>
                  <select id={`role-${u.id}`} value={u.role} onChange={(e)=> changeRole(u.id, e.target.value)} className="mx-2 p-1 border rounded text-xs">
                    <option value="user">{i18n.t('roles.user', { default: 'User' })}</option>
                    <option value="admin">{i18n.t('roles.admin', { default: 'Admin' })}</option>
                    <option value="manager_secondary">{i18n.t('roles.manager_secondary', { default: 'Secondary manager' })}</option>
                    <option value="manager_primary">{i18n.t('roles.manager_primary', { default: 'Primary manager' })}</option>
                  </select>
                </div>
                <div className="text-gray-400">{u.email || ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing({ ...u })} className="p-1 text-gray-600 hover:text-blue-600" aria-label={`${i18n.t('users.edit')} ${u.username}`}><Icon name="fas fa-edit" /></button>
              <button onClick={() => setPwResetUser(u)} className="p-1 text-gray-600 hover:text-green-600 relative" aria-label={`${i18n.t('users.resetPassword')} ${u.username}`}>
                <Icon name="fas fa-key" />
                {justResetUserId === u.id && (
                  <>
                    <span className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 text-green-600 text-xs" aria-hidden>
                      ✓
                    </span>
                    <span className="sr-only">{i18n.t('users.resetSuccess')}</span>
                  </>
                )}
              </button>
              <button onClick={() => deleteUser(u.id)} className="p-1 text-gray-600 hover:text-red-600" aria-label={`${i18n.t('users.deleteConfirm')} ${u.username}`}><Icon name="fas fa-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="mt-4 border-t pt-4">
          <h4 className="font-semibold mb-2">{editing.id ? i18n.t('users.edit') : i18n.t('users.new')}</h4>
          <div className="grid grid-cols-1 gap-3">
              <label className="block text-sm font-medium text-slate-700">{i18n.t('login.username')}</label>
              <input ref={nameRef} value={editing.username} onChange={e=>setEditing({...editing, username: e.target.value})} className="p-2 border rounded text-slate-800" />
              <label className="block text-sm font-medium text-slate-700">{i18n.t('users.roleLabel')}</label>
              <select value={editing.role} onChange={e=>setEditing({...editing, role: e.target.value})} className="p-2 border rounded">
              <option>مستخدم</option>
              <option>مشرف</option>
              <option>مدير ثانوي</option>
              <option>مدير أساسي</option>
            </select>
            {!editing.id && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">{i18n.t('users.tempPassword')}</label>
                  <input value={editing.password || ''} onChange={e=>setEditing({...editing, password: e.target.value})} type="password" className="p-2 border rounded text-slate-800" />
                </div>
            )}
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={()=> setEditing(null)} className="px-3 py-1 border rounded">{i18n.t('users.cancel')}</button>
        <button type="button" onClick={()=> saveUser(editing)} className="px-4 py-1 bg-blue-600 text-white rounded">{i18n.t('users.save')}</button>
      </div>
          </div>
        </div>
      )}

      {/* Pagination controls */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-gray-600">{i18n.t('users.previous')} {page} {i18n.t('users.next')} {Math.max(1, Math.ceil(total / pageSize))}</div>
        <div className="flex gap-2">
          <button disabled={page<=1} onClick={()=> { setPage(p=> Math.max(1, p-1)); fetchUsers(page-1) }} className="px-3 py-1 border rounded disabled:opacity-50">{i18n.t('users.previous')}</button>
          <button disabled={page>=Math.ceil(total / pageSize)} onClick={()=> { setPage(p=> p+1); fetchUsers(page+1) }} className="px-3 py-1 border rounded disabled:opacity-50">{i18n.t('users.next')}</button>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">{i18n.t('modal.close')}</button>
      </div>
      <PasswordResetModal
        open={!!pwResetUser}
        onClose={() => setPwResetUser(null)}
        user={pwResetUser}
        onConfirm={async (newPw) => {
          if (!pwResetUser) return
          const ok = await resetPassword(pwResetUser.id, newPw)
          if (ok){
            // clear any locally cached sensitive fields for that user
            setUsers(prev => prev.map(x => x.id === pwResetUser.id ? ({ ...x, password: undefined, passwordHash: undefined }) : x))
            // set transient success indicator
            setJustResetUserId(pwResetUser.id)
            setTimeout(()=> setJustResetUserId(null), 3000)
            // refresh server state to ensure canonical data
            fetchUsers()
          }
        }}
      />
    </ModalWrapper>
  )
}
