import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

// in-memory store for patients per queue to allow stateful tests
const queuesPatients = {
  q1: [ { id: 101, fullName: 'Ali', phoneNumber: '010', position: 1 }, { id: 102, fullName: 'Sara', phoneNumber: '011', position: 2 } ],
  q2: []
}

let nextId = 200

export const handlers = [
  // queues list
  rest.get(`${API_BASE}/api/queues`, (req, res, ctx) => {
    return res(ctx.json({ success: true, data: [ { id: 'q1', name: 'الطابور الأول' }, { id: 'q2', name: 'الطابور الثاني' } ] }))
  }),
  // templates
  rest.get(`${API_BASE}/api/templates`, (req, res, ctx) => {
    return res(ctx.json({ success: true, data: [ { id: 't1', title: 'تأكيد', content: 'أهلاً {name}' } ] }))
  }),
  // templates manager - create/update/delete
  rest.post(`${API_BASE}/api/templates`, async (req, res, ctx) => {
    const body = await req.json()
    const id = `t${Math.floor(Math.random()*1000)}`
    const tpl = { id, title: body.title, content: body.content }
    // for simplicity we don't persist in this demo
    return res(ctx.status(201), ctx.json({ success: true, data: tpl }))
  }),
  rest.put(`${API_BASE}/api/templates/:id`, async (req, res, ctx) => {
    const { id } = req.params
    const body = await req.json()
    return res(ctx.json({ success: true, data: { id, ...body } }))
  }),
  rest.delete(`${API_BASE}/api/templates/:id`, (req, res, ctx) => {
    return res(ctx.json({ success: true }))
  }),
  // patients for queue
  rest.get(`${API_BASE}/api/queues/:queueId/patients`, (req, res, ctx) => {
    const { queueId } = req.params
    const list = (queuesPatients[queueId] || []).slice().sort((a,b)=> (a.position||0)-(b.position||0))
    return res(ctx.json({ success: true, data: list }))
  }),
  // add patient
  rest.post(`${API_BASE}/api/queues/:queueId/patients`, async (req, res, ctx) => {
    const { queueId } = req.params
    const body = await req.json()
    const p = { id: nextId++, fullName: body.fullName || 'Unknown', phoneNumber: body.phoneNumber || '', position: body.desiredPosition || ((queuesPatients[queueId]?.length || 0) + 1) }
    queuesPatients[queueId] = queuesPatients[queueId] || []
    queuesPatients[queueId].push(p)
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
  // messages retry endpoint (simulate immediate success)
  rest.post(`${API_BASE}/api/messages/retry`, (req, res, ctx) => {
    return res(ctx.json({ success: true, retried: 1 }))
  }),
]

export default handlers
