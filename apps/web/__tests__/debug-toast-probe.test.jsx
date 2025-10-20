import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

// This is an ephemeral local-only test to probe toast emission and manager state.
// It intentionally logs to the console. Do NOT commit this file; it's for debug runs only.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

test('debug: probe clinics:show-toast event and global manager', async () => {
  // attach listener for the custom event
  const events = []
  window.addEventListener('clinics:show-toast', (e) => {
    // record event details
    console.log('[debug-toast] clinics:show-toast event', e.detail)
    events.push({ type: 'event', detail: e.detail })
  })

  // small helper to inspect the global manager if present
  function inspectGlobalManager(){
    try{
      const mgr = globalThis.__CLINICS_TOAST__
      console.log('[debug-toast] globalThis.__CLINICS_TOAST__ =', mgr)
      return mgr
    }catch(e){
      console.log('[debug-toast] global manager inspect failed', e)
      return null
    }
  }

  // Render the app (Dashboard) with providers
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })

  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select the first patient (test UI uses label 'select-patient-0')
  fireEvent.click(screen.getByLabelText('select-patient-0'))

  // ensure manager available before actions
  inspectGlobalManager()

  // spy on api.post to see if message send is invoked
  const api = require('../lib/api')
  const origPost = api.post
  api.post = async function wrappedPost(url, body, opts){
    console.log('[debug-toast] api.post called', url, body)
    try{
      return await origPost(url, body, opts)
    }finally{
      // no-op
    }
  }

  // also wrap axios low-level request to ensure network invocation is visible
  try{
    const axios = require('axios')
    const origReq = axios.request
    axios.request = async function wrappedRequest(cfg){
      console.log('[debug-toast] axios.request called', cfg && cfg.url)
      return origReq.call(this, cfg)
    }
  }catch(e){ console.log('[debug-toast] axios wrap failed', e) }

  // use MSW to simulate transient failure then success by importing server/ rest directly
  const { server } = require('../mocks/server')
  const { rest } = require('msw')
  let called = 0
  const transient = rest.post(API_BASE + '/api/messages/send', (req, res, ctx) => {
    called++
    console.log('[debug-toast] api/messages/send handler called', called)
    if (called === 1) return res(ctx.status(500), ctx.json({ success: false }))
    return res(ctx.json({ success: true, queued: 1 }))
  })
  server.use(transient)

  // open modal and send
  console.log('[debug-toast] clicking "إرسال رسالة"')
  fireEvent.click(screen.getByText('إرسال رسالة'))
  const sendBtn = await screen.findByText('إرسال')
  // ensure the textarea has content (modal may be empty if no template selected)
  const textarea = screen.getByLabelText('معاينة الرسالة')
  fireEvent.change(textarea, { target: { value: 'اختبار' } })
  console.log('[debug-toast] found send button, clicking (after filling textarea)')
  fireEvent.click(sendBtn)
  console.log('[debug-toast] clicked send button, DOM snapshot:')
  console.log(document.body.innerHTML.slice(0, 2000))

  // wait shortly and inspect
  await new Promise(r => setTimeout(r, 50))
  inspectGlobalManager()
  const fallback = document.querySelector('.clinics-toast-fallback')
  console.log('[debug-toast] fallback element present?', !!fallback, fallback && fallback.textContent)

  // expect failure toast (this is the failing assertion in CI tests; we won't assert here, just probe)
  try{
    await waitFor(()=> screen.getByText(/فشل إرسال الرسالة|Some failed/i), { timeout: 1000 })
    console.log('[debug-toast] found failure toast in DOM (getText matched)')
  }catch(e){
    console.log('[debug-toast] did NOT find failure toast via getByText')
  }

  // send again (should succeed)
  fireEvent.click(screen.getByText('إرسال رسالة'))
  const sendBtn2 = await screen.findByText('إرسال')
  fireEvent.click(sendBtn2)

  await new Promise(r => setTimeout(r, 50))
  inspectGlobalManager()
  const fallback2 = document.querySelector('.clinics-toast-fallback')
  console.log('[debug-toast] fallback element present after second send?', !!fallback2, fallback2 && fallback2.textContent)

  try{
    await waitFor(()=> screen.getByText(/تم إرسال الرسالة/), { timeout: 1000 })
    console.log('[debug-toast] found success toast in DOM (getText matched)')
  }catch(e){
    console.log('[debug-toast] did NOT find success toast via getByText')
  }

  // log collected events
  console.log('[debug-toast] collected events:', events)

})
