import React, { createContext, useContext, useState, useEffect } from 'react'
import api from './api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'

const AuthContext = createContext()

export const AuthProvider = ({ children, initialToken, initialUser }) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [initializing, setInitializing] = useState(true)
  
  // Initialize token from localStorage or initialToken immediately (before first render)
  const [token, setToken] = useState(() => {
    if (initialToken) return initialToken
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        api.defaults.headers.Authorization = `Bearer ${storedToken}`
        return storedToken
      }
    }
    return null
  })

  // Mark initialization as complete after first render
  useEffect(() => {
    setInitializing(false)
  }, [])

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/Auth/me')
        return res.data.data || res.data
      } catch (error) {
        // If fetching user fails, token is likely invalid
        logout()
        return null
      }
    },
    enabled: !!token && !initialUser, // Only run if a token exists and no initial user is provided
    initialData: initialUser,
    staleTime: Infinity,
    cacheTime: Infinity,
  })

  const login = (newToken) => {
    localStorage.setItem('token', newToken)
    api.defaults.headers.Authorization = `Bearer ${newToken}`
    setToken(newToken)
    queryClient.invalidateQueries({ queryKey: ['user'] })
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.Authorization
    setToken(null)
    queryClient.setQueryData(['user'], null)
    router.push('/login')
  }

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading: initializing || userLoading || (!!token && !user),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  return useContext(AuthContext)
}
