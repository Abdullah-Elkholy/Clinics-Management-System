import 'cross-fetch/polyfill'

test('queues API and messages retry endpoints respond via MSW', async ()=>{
  // Verify queues endpoint returns expected data
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  const qRes = await fetch(base + '/api/Queues')
  const qJson = await qRes.json()
  expect(qJson).toHaveProperty('success', true)
  // new API returns queues under `data` and uses `doctorName`
  expect(Array.isArray(qJson.data)).toBe(true)
  expect(qJson.data.some(q => q.doctorName && q.doctorName.includes('الطابور'))).toBe(true)

  // Verify retry endpoint returns success
  const rRes = await fetch(base + '/api/messages/retry', { method: 'POST' })
  const rJson = await rRes.json()
  expect(rJson).toHaveProperty('success', true)
})
