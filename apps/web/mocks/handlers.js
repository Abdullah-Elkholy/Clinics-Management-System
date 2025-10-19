import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

// in-memory store for patients per queue to allow stateful tests
let queuesPatients = {
  q1: [ { id: 101, fullName: 'Ali', phoneNumber: '010', position: 1 }, { id: 102, fullName: 'Sara', phoneNumber: '011', position: 2 } ],
  q2: []
}

let nextId = 200

// templates persisted in-memory for tests
let templatesList = [ { id: 't1', title: 'تأكيد', content: 'أهلاً {name}' } ]

// helper to reset in-memory data to initial state between tests
export function resetMockData(){
  queuesPatients = {
    q1: [ { id: 101, fullName: 'Ali', phoneNumber: '010', position: 1 }, { id: 102, fullName: 'Sara', phoneNumber: '011', position: 2 } ],
    q2: []
  }
  nextId = 200
  templatesList = [ { id: 't1', title: 'تأكيد', content: 'أهلاً {name}' } ]
}

export const handlers = [
  // queues list (returns new `data` shape matching QueueDto)
  rest.get(`${API_BASE}/api/queues`, (req, res, ctx) => {
    const list = [
      { id: 'q1', doctorName: 'الطابور الأول', description: 'وصف', createdBy: 1, currentPosition: 1, estimatedWaitMinutes: 15, patientCount: 2 },
      { id: 'q2', doctorName: 'الطابور الثاني', description: '', createdBy: 1, currentPosition: 1, estimatedWaitMinutes: 10, patientCount: 0 }
    ]
    return res(ctx.json({ success: true, data: list }))
  }),
  // templates
  rest.get(`${API_BASE}/api/templates`, (req, res, ctx) => {
      return res(ctx.json({ success: true, templates: templatesList }))
    }),
    // templates manager - create/update/delete
    rest.post(`${API_BASE}/api/templates`, async (req, res, ctx) => {
      const body = await req.json()
      const id = `t${Math.floor(Math.random()*1000)}`
      const tpl = { id, title: body.title, content: body.content }
      templatesList.push(tpl)
      return res(ctx.status(201), ctx.json({ success: true, data: tpl }))
    }),
    rest.put(`${API_BASE}/api/templates/:id`, async (req, res, ctx) => {
      const { id } = req.params
      const body = await req.json()
      const idx = templatesList.findIndex(t=>t.id===id)
      if (idx !== -1) templatesList[idx] = { id, ...body }
      return res(ctx.json({ success: true, data: { id, ...body } }))
    }),
    rest.delete(`${API_BASE}/api/templates/:id`, (req, res, ctx) => {
      const { id } = req.params
      const idx = templatesList.findIndex(t=>t.id===id)
      if (idx !== -1) templatesList.splice(idx,1)
      return res(ctx.json({ success: true }))
    }),
  // patients for queue
  // support both /api/queues/:queueId/patients and /api/patients?queueId=... used by different client paths
  rest.get(`${API_BASE}/api/patients`, (req, res, ctx) => {
    const queueId = req.url.searchParams.get('queueId')
    const list = (queuesPatients[queueId] || []).slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.json({ success: true, patients: list }))
  }),

  rest.get(`${API_BASE}/api/queues/:queueId/patients`, (req, res, ctx) => {
    const { queueId } = req.params
    // Return the in-memory patients for the queue (q1 uses queuesPatients state too)
    const list = (queuesPatients[queueId] || []).slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.json({ success: true, patients: list }))
  }),
  // add patient
  rest.post(`${API_BASE}/api/queues/:queueId/patients`, async (req, res, ctx) => {
    const { queueId } = req.params
    const body = await req.json()
    queuesPatients[queueId] = queuesPatients[queueId] || []
    // determine position
    let pos = body.desiredPosition ? parseInt(body.desiredPosition, 10) : (queuesPatients[queueId].length + 1)
    if (!pos || pos < 1) pos = queuesPatients[queueId].length + 1
    // shift existing patients at >= pos
    queuesPatients[queueId].forEach(p => { if ((p.position||0) >= pos) p.position = (p.position||0) + 1 })
    const p = { id: nextId++, fullName: body.fullName || 'Unknown', phoneNumber: body.phoneNumber || '', position: pos }
    queuesPatients[queueId].push(p)
    // normalize ordering
    queuesPatients[queueId] = queuesPatients[queueId].slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.status(201), ctx.json({ success: true, data: p }))
  }),
  // users endpoints
  rest.get(`${API_BASE}/api/users`, (req, res, ctx) => {
    return res(ctx.json({ success: true, data: [ { id:1, username: 'admin', fullName: 'المدير الأساسي', role: 'primary_admin' } ] }))
  }),
  rest.post(`${API_BASE}/api/users`, async (req, res, ctx) => {
    const body = await req.json()
    return res(ctx.status(201), ctx.json({ success: true, data: { id: Math.floor(Math.random()*1000), ...body } }))
  }),
  // reorder
  rest.post(`${API_BASE}/api/queues/:queueId/reorder`, async (req, res, ctx) => {
    const { queueId } = req.params
    const body = await req.json()
    if (Array.isArray(body.positions)){
      const map = (queuesPatients[queueId] || []).reduce((acc,p)=> (acc[p.id]=p,acc), {})
      body.positions.forEach(pos => { if (map[pos.id]) map[pos.id].position = pos.position })
      // reassign sorted array
      queuesPatients[queueId] = Object.values(map).sort((a,b)=> (a.position||0)-(b.position||0))
    }
    return res(ctx.json({ success: true }))
  }),
  // messages send
  rest.post(`${API_BASE}/api/messages/send`, (req, res, ctx) => {
    return res(ctx.json({ success: true, queued: 1 }))
  }),
  // delete single patient
  rest.delete(`${API_BASE}/api/patients/:id`, (req, res, ctx) => {
    const { id } = req.params
    // find and remove from any queue
    Object.keys(queuesPatients).forEach(q => {
      const idx = (queuesPatients[q] || []).findIndex(p => String(p.id) === String(id))
      if (idx !== -1) queuesPatients[q].splice(idx,1)
    })
    return res(ctx.json({ success: true }))
  }),
  // messages retry endpoint (simulate immediate success)
  rest.post(`${API_BASE}/api/messages/retry`, (req, res, ctx) => {
    return res(ctx.json({ success: true, retried: 1 }))
  }),
]

export default handlers
