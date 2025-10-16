import '@testing-library/jest-dom'
import { server } from './mocks/server'

// Start MSW before all tests and stop after
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// helper to pre-seed localStorage
global.seedLocalStorage = function (items = {}){
	Object.keys(items).forEach(k => {
		try { localStorage.setItem(k, items[k]) } catch(e) {}
	})
}

// accessibility helper
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)
global.axe = axe

// polyfill fetch for node tests
// polyfill fetch, Request, Headers, Response for node tests
import 'cross-fetch/polyfill'

// stub/override window.alert used by some components (jsdom's default throws)
if (typeof window !== 'undefined') {
	window.alert = () => {}
}

