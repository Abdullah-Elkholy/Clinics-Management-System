import React, { createContext, useContext, useState, useEffect } from 'react'
import api from './api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'

const AuthContext = createContext()

export const AuthProvider = ({ children, initialToken, initialUser }) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  
  // Initialize token from localStorage or initialToken immediately (before first render)
  const [token, setToken] = useState(() => {
    if (initialToken) return initialToken
    if (typeof window !== 'undefined') {
      try {
        const storedToken = localStorage.getItem('accessToken')
        if (storedToken) {
          // Set header immediately so first requests can use it
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
          return storedToken
        }
      } catch (e) {
        // localStorage might be unavailable in some SSR contexts
      }
    }
    return null
  })

  // Ensure auth header is always set when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common['Authorization']
    }
  }, [token])

  // Fetch user data
  const { data: user, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/Auth/me')
        return res.data.data || res.data
      } catch (error) {
        console.error('[AuthProvider] Failed to fetch user:', error.response?.status)
        // If 401 or error, token is likely invalid
        if (error.response?.status === 401) {
          setToken(null)
          try { localStorage.removeItem('accessToken') } catch (e) {}
        }
        return null
      }
    },
    enabled: !!token && !initialUser, // Only run if a token exists
    initialData: initialUser,
    staleTime: Infinity,
    cacheTime: Infinity,
    retry: 1, // Only retry once for auth failures
  })

  // Mark auth as ready once we've determined whether there's a user or not
  useEffect(() => {
    // Auth is ready when:
    // 1. If there's a token, the user query has finished loading
    // 2. If there's no token, immediately
    if (!token || !userLoading) {
      setAuthReady(true)
    }
  }, [token, userLoading])

  const login = (newToken) => {
    try { localStorage.setItem('accessToken', newToken) } catch (e) {}
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    // Invalidate all queries to fetch fresh data
    queryClient.removeQueries()
  }

  const logout = () => {
    try { localStorage.removeItem('accessToken') } catch (e) {}
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    queryClient.clear()
    router.push('/login')
  }

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading: userLoading,
    isReady: authReady, // New: indicate when auth initialization is complete
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
