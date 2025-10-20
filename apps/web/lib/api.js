import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000',
  withCredentials: true
})

// attach auth header from localStorage if present (single implementation below)

// login helper
export async function login(username, password) {
  const res = await api.post('/api/Auth/login', { username, password })
  if (res?.data?.success) {
    const data = res.data.data
    // support both accessToken and AccessToken casing returned by different endpoints
    const token = data?.accessToken ?? data?.AccessToken
    const user = data?.user ?? data?.User
    // store access token (in-memory/localStorage) and set header
    if (token) {
      try { localStorage.setItem('accessToken', token) } catch (e) {}
      setAuth(token)
    }
    if (user) {
      try { localStorage.setItem('currentUser', JSON.stringify(user)) } catch (e) {}
    }
  }
  return res.data
}

export async function logout() {
  try { await api.post('/api/auth/logout') } catch (e) {}
  try { localStorage.removeItem('accessToken'); localStorage.removeItem('currentUser') } catch (e) {}
  setAuth(null)
}

// Refresh token flow: call refresh endpoint (server reads refresh cookie)
let isRefreshing = false
let refreshSubscribers = []
function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}
function subscribeRefresh(cb) { refreshSubscribers.push(cb) }

api.interceptors.response.use(
  r => {
    return r
  },
  async err => {
    const original = err.config
    if (err.response && err.response.status === 401 && !original._retry) {
      // try refresh once
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeRefresh((token) => {
            if (token) {
              original.headers['Authorization'] = `Bearer ${token}`
              resolve(api(original))
            } else reject(err)
          })
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const r = await api.post('/api/auth/refresh')
        if (r?.data?.success && r.data.data?.accessToken) {
          const token = r.data.data.accessToken
          try { localStorage.setItem('accessToken', token) } catch (e) {}
          setAuth(token)
          onRefreshed(token)
          return api(original)
        }
      } catch (e) {
        // refresh failed
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export function setAuth(token) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}

export default api

// initialize auth from localStorage (call from client entry)
export function initAuth() {
  if (typeof window === 'undefined') return
  try {
    const token = localStorage.getItem('accessToken')
    if (token) setAuth(token)
  } catch (e) {}
}
