import { setupServer } from 'msw/node'
import handlers from './handlers'
import { rest } from 'msw'

export const server = setupServer(
  ...handlers,
  rest.get('/api/patients', (req, res, ctx) => {
    return res(ctx.json({ patients: [], total: 0 }))
  }),
  rest.get('/api/queues', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: 'Queue 1', patientCount: 2 }]))
  }),
)
export default server
