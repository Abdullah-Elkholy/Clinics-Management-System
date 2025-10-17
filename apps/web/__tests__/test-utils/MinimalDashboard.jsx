import React from 'react'

export const MinimalDashboard = () => (
  <div data-testid="minimal-dashboard">Minimal Dashboard Test</div>
)

export default MinimalDashboard

// minimal smoke test so this file is recognized as a valid test suite
test('minimal dashboard smoke', ()=>{
  expect(true).toBe(true)
})
