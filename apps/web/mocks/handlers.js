import { rest } from 'msw'
import { ROLES } from '../lib/roles'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

// in-memory store for patients per queue to allow stateful tests
export let mockPatients = {
  q1: [ { id: 101, fullName: 'Ali', phoneNumber: '010', position: 1 }, { id: 102, fullName: 'Sara', phoneNumber: '011', position: 2 } ],
  q2: []
}

let nextId = 200

// templates persisted in-memory for tests
let templatesList = [ { id: 't1', title: 'تأكيد', content: 'أهلاً {name}' } ]

// helper to reset in-memory data to initial state between tests
export function resetMockData(){
  mockPatients = {
    q1: [ { id: 101, fullName: 'Ali', phoneNumber: '010', position: 1 }, { id: 102, fullName: 'Sara', phoneNumber: '011', position: 2 } ],
    q2: []
  }
  nextId = 200
  templatesList = [ { id: 't1', title: 'تأكيد', content: 'أهلاً {name}' } ]
}

export const handlers = [
  // login/auth - using capital A to match ASP.NET controller route
  rest.post(`${API_BASE}/api/Auth/login`, async (req, res, ctx) => {
    const body = await req.json()
    // Simple auth logic for testing
    if (body.username === 'admin' && body.password === 'Admin123!') {
      return res(ctx.json({ 
        success: true, 
        data: { 
          accessToken: 'fake-token-admin',
          user: { id: 1, username: 'admin', role: ROLES.PRIMARY_ADMIN }
        } 
      }))
    }
    if (body.username && body.password) {
      return res(ctx.json({ 
        success: true, 
        data: { 
          accessToken: 'fake-token',
          user: { id: 2, username: body.username, role: ROLES.USER }
        } 
      }))
    }
    return res(ctx.status(401), ctx.json({ success: false, message: 'Invalid credentials' }))
  }),
  // auth/me endpoint
  rest.get(`${API_BASE}/api/Auth/me`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization')
    if (authHeader && authHeader.includes('fake-token')) {
      return res(ctx.json({ 
        success: true,
        data: { id: 1, username: 'admin', name: 'Admin User', role: ROLES.PRIMARY_ADMIN }
      }))
    }
    return res(ctx.status(401), ctx.json({ success: false, message: 'Unauthorized' }))
  }),
  // auth/refresh endpoint (to silence warnings)
  rest.post(`${API_BASE}/api/Auth/refresh`, (req, res, ctx) => {
    return res(ctx.status(401), ctx.json({ success: false, message: 'No refresh needed in tests' }))
  }),
  // queues list (returns new `data` shape matching QueueDto)
  rest.get(`${API_BASE}/api/Queues`, (req, res, ctx) => {
    const list = [
      { 
        id: 'q1', 
        doctorName: 'الطابور الأول',
        description: 'وصف',
        createdBy: 1,
        currentPosition: 1,
        estimatedWaitMinutes: 15,
        patientCount: 2
      },
      { 
        id: 'q2',
        doctorName: 'الطابور الثاني',
        description: '',
        createdBy: 1,
        currentPosition: 1,
        estimatedWaitMinutes: 10,
        patientCount: 0
      }
    ]
    return res(ctx.json({ success: true, data: list }))
  }),
  // templates
  rest.get(`${API_BASE}/api/Templates`, (req, res, ctx) => {
      return res(ctx.json({ success: true, data: templatesList }))
    }),
    // templates manager - create/update/delete
    rest.post(`${API_BASE}/api/Templates`, async (req, res, ctx) => {
      const body = await req.json()
      const id = `t${Math.floor(Math.random()*1000)}`
      const tpl = { id, title: body.title, content: body.content }
      templatesList.push(tpl)
      return res(ctx.status(201), ctx.json({ success: true, data: tpl }))
    }),
    rest.put(`${API_BASE}/api/Templates/:id`, async (req, res, ctx) => {
      const { id } = req.params
      const body = await req.json()
      const idx = templatesList.findIndex(t=>t.id===id)
      if (idx !== -1) templatesList[idx] = { id, ...body }
      return res(ctx.json({ success: true, data: { id, ...body } }))
    }),
    rest.delete(`${API_BASE}/api/Templates/:id`, (req, res, ctx) => {
      const { id } = req.params
      const idx = templatesList.findIndex(t=>t.id===id)
      if (idx !== -1) templatesList.splice(idx,1)
      return res(ctx.json({ success: true }))
    }),
  // patients for queue
  // support both /api/Queues/:queueId/patients and /api/patients?queueId=... used by different client paths
  rest.get(`${API_BASE}/api/patients`, (req, res, ctx) => {
    const queueId = req.url.searchParams.get('queueId')
    const list = (mockPatients[queueId] || []).slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.json({ success: true, patients: list }))
  }),

  rest.get(`${API_BASE}/api/Queues/:queueId/patients`, (req, res, ctx) => {
    const { queueId } = req.params
    // Return the in-memory patients for the queue
    const list = (mockPatients[queueId] || []).slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.json({ success: true, patients: list }))
  }),
  // add patient
  rest.post(`${API_BASE}/api/Queues/:queueId/patients`, async (req, res, ctx) => {
    const { queueId } = req.params
    const body = await req.json()
    mockPatients[queueId] = mockPatients[queueId] || []
    // determine position
    let pos = body.desiredPosition ? parseInt(body.desiredPosition, 10) : (mockPatients[queueId].length + 1)
    if (!pos || pos < 1) pos = mockPatients[queueId].length + 1
    // shift existing patients at >= pos
    mockPatients[queueId].forEach(p => { if ((p.position||0) >= pos) p.position = (p.position||0) + 1 })
    const p = { id: nextId++, fullName: body.fullName || 'Unknown', phoneNumber: body.phoneNumber || '', position: pos }
    mockPatients[queueId].push(p)
    // normalize ordering
    mockPatients[queueId] = mockPatients[queueId].slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.status(201), ctx.json({ success: true, data: p }))
  }),
  // users endpoints
  rest.get(`${API_BASE}/api/Users`, (req, res, ctx) => {
    return res(ctx.json({ success: true, data: [ { id:1, username: 'admin', fullName: 'المدير الأساسي', role: ROLES.PRIMARY_ADMIN } ] }))
  }),
  rest.post(`${API_BASE}/api/Users`, async (req, res, ctx) => {
    const body = await req.json()
    return res(ctx.status(201), ctx.json({ success: true, data: { id: Math.floor(Math.random()*1000), ...body } }))
  }),
  // reorder
  rest.post(`${API_BASE}/api/Queues/:queueId/reorder`, async (req, res, ctx) => {
    const { queueId } = req.params
    const { positions } = await req.json()
    if (mockPatients[queueId] && positions) {
      positions.forEach(p => {
        const patient = mockPatients[queueId].find(pat => pat.id === p.id)
        if (patient) {
          patient.position = p.position
        }
      })
      // sort the array to reflect the new order
      mockPatients[queueId].sort((a, b) => a.position - b.position)
    }
    return res(ctx.json({ success: true }))
  }),
  // messages send
  rest.post(`${API_BASE}/api/Messages/send`, (req, res, ctx) => {
    return res(ctx.json({ success: true, queued: 1 }))
  }),
  // delete single patient
  rest.delete(`${API_BASE}/api/Patients/:id`, (req, res, ctx) => {
    const { id } = req.params
    // find and remove from any queue
    Object.keys(mockPatients).forEach(q => {
      const idx = (mockPatients[q] || []).findIndex(p => String(p.id) === String(id))
      if (idx !== -1) mockPatients[q].splice(idx,1)
    })
    return res(ctx.json({ success: true }))
  }),
  // messages retry endpoint (simulate immediate success)
  rest.post(`${API_BASE}/api/Messages/retry`, (req, res, ctx) => {
    return res(ctx.json({ success: true, retried: 1 }))
  }),
]

export default handlers
