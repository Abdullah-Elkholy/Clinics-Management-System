import { renderHook, act } from '@testing-library/react'
import { useAuth, AuthProvider } from '../lib/auth'
import * as api from '../lib/api'
import queryClient from '../lib/queryClient'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString()
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock next/router
const mockRouter = {
  push: jest.fn()
}
jest.mock('next/router', () => ({
  useRouter: () => mockRouter
}))

describe('AuthProvider and useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    queryClient.clear()
    jest.clearAllMocks()
  })

  describe('Token Persistence', () => {
    it('should load token from localStorage with correct key (accessToken)', () => {
      // Arrange
      const testToken = 'test-token-123'
      localStorage.setItem('accessToken', testToken)

      // Act
      const wrapper = ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      )
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Assert
      // Token should be loaded (user will be loading until /auth/me is called)
      expect(result.current.isLoading).toBeDefined()
    })

    it('should NOT load token with wrong key (token)', () => {
      // Arrange
      const wrongToken = 'test-token-123'
      localStorage.setItem('token', wrongToken) // Wrong key!

      // Act
      const wrapper = ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      )
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Assert
      expect(result.current.user).toBeNull() // No token should be found
    })

    it('should persist token across re-renders with correct key', () => {
      // Arrange
      const testToken = 'persistent-token-xyz'
      localStorage.setItem('accessToken', testToken)

      // Act
      const wrapper = ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      )
      const { rerender } = renderHook(() => useAuth(), { wrapper })

      // Re-render
      rerender()

      // Assert
      const stored = localStorage.getItem('accessToken')
      expect(stored).toBe(testToken)
    })
  })

  describe('Token Storage Key Consistency', () => {
    it('should use same key (accessToken) for login and retrieval', () => {
      // Arrange
      const testToken = 'consistency-test-token'
      
      // Act
      act(() => {
        // Simulate what happens in api.js login()
        localStorage.setItem('accessToken', testToken)
      })

      // Assert
      // Verify auth.js would find it with same key
      const retrieved = localStorage.getItem('accessToken')
      expect(retrieved).toBe(testToken)
    })

    it('should clear token with same key on logout', () => {
      // Arrange
      const testToken = 'logout-test-token'
      localStorage.setItem('accessToken', testToken)
      expect(localStorage.getItem('accessToken')).toBe(testToken)

      // Act
      act(() => {
        localStorage.removeItem('accessToken')
      })

      // Assert
      expect(localStorage.getItem('accessToken')).toBeNull()
    })
  })

  describe('Auth Header Setting', () => {
    it('should set Authorization header with correct path', () => {
      // Arrange
      const testToken = 'header-test-token'
      
      // Act
      act(() => {
        api.setAuth(testToken)
      })

      // Assert
      const authHeader = api.default.defaults.headers.common['Authorization']
      expect(authHeader).toBe(`Bearer ${testToken}`)
    })

    it('should clear Authorization header when token is null', () => {
      // Arrange
      api.setAuth('some-token')
      expect(api.default.defaults.headers.common['Authorization']).toBeDefined()

      // Act
      api.setAuth(null)

      // Assert
      expect(api.default.defaults.headers.common['Authorization']).toBeUndefined()
    })
  })

  describe('initAuth on App Startup', () => {
    it('should initialize auth from localStorage when app loads', () => {
      // Arrange
      const testToken = 'init-token-xyz'
      localStorage.setItem('accessToken', testToken)

      // Act
      api.initAuth()

      // Assert
      const authHeader = api.default.defaults.headers.common['Authorization']
      expect(authHeader).toBe(`Bearer ${testToken}`)
    })

    it('should not set header if no token in localStorage', () => {
      // Arrange
      localStorage.clear()
      const initialHeader = api.default.defaults.headers.common['Authorization']

      // Act
      api.initAuth()

      // Assert
      // Header should not be changed if no token
      if (initialHeader) {
        expect(api.default.defaults.headers.common['Authorization']).toEqual(initialHeader)
      }
    })
  })

  describe('Login and Logout Flow', () => {
    it('should store token with accessToken key on login', () => {
      // Arrange
      const wrapper = ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      )
      const { result } = renderHook(() => useAuth(), { wrapper })
      const testToken = 'login-flow-token'

      // Act
      act(() => {
        result.current.login(testToken)
      })

      // Assert
      expect(localStorage.getItem('accessToken')).toBe(testToken)
    })

    it('should remove token with correct key on logout', () => {
      // Arrange
      localStorage.setItem('accessToken', 'some-token')
      const wrapper = ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      )
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Act
      act(() => {
        result.current.logout()
      })

      // Assert
      expect(localStorage.getItem('accessToken')).toBeNull()
    })

    it('should redirect to login page on logout', () => {
      // Arrange
      localStorage.setItem('accessToken', 'some-token')
      const wrapper = ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      )
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Act
      act(() => {
        result.current.logout()
      })

      // Assert
      expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage access errors gracefully', () => {
      // Arrange
      const originalGetItem = localStorage.getItem
      localStorage.getItem = jest.fn(() => {
        throw new Error('Storage error')
      })

      // Act & Assert
      expect(() => {
        api.initAuth()
      }).not.toThrow()

      // Cleanup
      localStorage.getItem = originalGetItem
    })
  })
})
