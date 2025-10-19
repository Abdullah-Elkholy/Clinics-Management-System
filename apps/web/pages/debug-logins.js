import React, { useState } from 'react'
import { login, setAuth } from '../lib/api'

export default function DebugLogins() {
  const seeded = [
    { username: 'admin', password: 'admin123' },
    { username: 'admin2', password: 'admin123' },
    { username: 'mod1', password: 'mod123' },
    { username: 'user1', password: 'user123' }
  ]
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastToken, setLastToken] = useState('')
  const [selected, setSelected] = useState(seeded[0].username)
  const [autoRedirect, setAutoRedirect] = useState(true)

  async function tryLogin(u) {
    setLoading(true)
    setOutput('')
    try {
      const res = await login(u.username, u.password)
      const token = res?.data?.accessToken ?? res?.data?.AccessToken
      if (res?.success && token) {
        setOutput(JSON.stringify(res.data, null, 2))
        // ensure auth header is set for the session
        setAuth(token)
        setLastToken(token)
        if (autoRedirect) {
          try { localStorage.setItem('accessToken', token); window.location.href = '/dashboard' } catch {}
        }
      } else {
        setOutput('Login returned: ' + JSON.stringify(res))
      }
    } catch (e) {
      setOutput('Error: ' + (e?.message || String(e)))
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Debug login shortcuts</h2>
      <p>API base: <strong>{process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}</strong></p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select value={selected} onChange={e => setSelected(e.target.value)}>
          {seeded.map(s => <option key={s.username} value={s.username}>{s.username}</option>)}
        </select>
        <button onClick={() => tryLogin(seeded.find(x => x.username === selected))} disabled={loading}>Login selected</button>
        <label style={{ marginLeft: 12 }}>
          <input type="checkbox" checked={autoRedirect} onChange={e => setAutoRedirect(e.target.checked)} /> Auto-redirect
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button disabled={!lastToken} onClick={() => { navigator.clipboard?.writeText(lastToken); alert('Token copied') }}>Copy last token</button>
        <button disabled={!lastToken} onClick={() => { try { localStorage.setItem('accessToken', lastToken); setAuth(lastToken); window.location.href = '/dashboard' } catch (e) { alert('Failed to use token: ' + e?.message) } }}>Use token (go to /dashboard)</button>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12 }}>{output}</pre>
    </div>
  )
}
