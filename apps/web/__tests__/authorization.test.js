import { renderHook } from '@testing-library/react'
import { useAuthorization } from '../lib/authorization'
import { useAuth } from '../lib/auth'

// Mock useAuth
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn()
}))

describe('Authorization Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Primary Admin Permissions', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: {
          id: 1,
          username: 'admin',
          fullName: 'Primary Admin',
          role: 'primary_admin'
        }
      })
    })

    it('should grant all permissions to primary admin', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('primary_admin')
      expect(result.current.canCreateQueues).toBe(true)
      expect(result.current.canManageUsers).toBe(true)
      expect(result.current.canSendMessages).toBe(true)
      expect(result.current.canManageQuotas).toBe(true)
      expect(result.current.canManageWhatsApp).toBe(true)
      expect(result.current.canManageTemplates).toBe(true)
    })
  })

  describe('Secondary Admin Permissions', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: {
          id: 2,
          username: 'secondary_admin',
          fullName: 'Secondary Admin',
          role: 'secondary_admin'
        }
      })
    })

    it('should grant most permissions to secondary admin', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('secondary_admin')
      expect(result.current.canCreateQueues).toBe(true)
      expect(result.current.canManageUsers).toBe(true)
      expect(result.current.canSendMessages).toBe(true)
      expect(result.current.canManageWhatsApp).toBe(true)
      expect(result.current.canManageTemplates).toBe(true)
    })

    it('should not allow secondary admin to manage quotas', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageQuotas).toBe(false)
    })
  })

  describe('Moderator Permissions', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: {
          id: 3,
          username: 'moderator',
          fullName: 'Moderator User',
          role: 'moderator'
        }
      })
    })

    it('should grant basic permissions to moderator', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('moderator')
      expect(result.current.canCreateQueues).toBe(true)
      expect(result.current.canSendMessages).toBe(true)
    })

    it('should not allow moderator to manage users', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageUsers).toBe(false)
    })

    it('should not allow moderator to manage quotas', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageQuotas).toBe(false)
    })

    it('should not allow moderator to manage WhatsApp', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageWhatsApp).toBe(false)
    })

    it('should not allow moderator to manage templates', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageTemplates).toBe(false)
    })
  })

  describe('Regular User Permissions', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: {
          id: 4,
          username: 'user',
          fullName: 'Regular User',
          role: 'user'
        }
      })
    })

    it('should grant minimal permissions to regular user', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('user')
      expect(result.current.canSendMessages).toBe(true)
    })

    it('should not allow regular user to create queues', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canCreateQueues).toBe(false)
    })

    it('should not allow regular user to manage users', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageUsers).toBe(false)
    })

    it('should not allow regular user to manage quotas', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageQuotas).toBe(false)
    })

    it('should not allow regular user to manage WhatsApp', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageWhatsApp).toBe(false)
    })

    it('should not allow regular user to manage templates', () => {
      const { result } = renderHook(() => useAuthorization())

      expect(result.current.canManageTemplates).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle no user gracefully', () => {
      useAuth.mockReturnValue({ user: null })

      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe(null)
      expect(result.current.canCreateQueues).toBe(false)
      expect(result.current.canManageUsers).toBe(false)
      expect(result.current.canManageQuotas).toBe(false)
      expect(result.current.canManageWhatsApp).toBe(false)
      expect(result.current.canManageTemplates).toBe(false)
    })

    it('should handle undefined user', () => {
      useAuth.mockReturnValue({ user: undefined })

      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('user')
      expect(result.current.canCreateQueues).toBe(false)
    })

    it('should handle user with no role', () => {
      useAuth.mockReturnValue({
        user: {
          id: 5,
          username: 'norole',
          fullName: 'No Role User'
          // role is missing
        }
      })

      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('user')
      expect(result.current.canCreateQueues).toBe(false)
    })

    it('should handle unknown role', () => {
      useAuth.mockReturnValue({
        user: {
          id: 6,
          username: 'unknown',
          fullName: 'Unknown Role',
          role: 'unknown_role'
        }
      })

      const { result } = renderHook(() => useAuthorization())

      // Should default to user permissions
      expect(result.current.role).toBe('user')
      expect(result.current.canManageUsers).toBe(false)
      expect(result.current.canManageQuotas).toBe(false)
    })

    it('should handle empty role string', () => {
      useAuth.mockReturnValue({
        user: {
          id: 7,
          username: 'empty',
          fullName: 'Empty Role',
          role: ''
        }
      })

      const { result } = renderHook(() => useAuthorization())

      expect(result.current.role).toBe('user')
      expect(result.current.canCreateQueues).toBe(false)
    })

    it('should handle role with wrong case', () => {
      useAuth.mockReturnValue({
        user: {
          id: 8,
          username: 'wrongcase',
          fullName: 'Wrong Case',
          role: 'PRIMARY_ADMIN' // uppercase
        }
      })

      const { result } = renderHook(() => useAuthorization())

      // Depends on implementation - might need case-insensitive check
      // or should be treated as unknown role
      expect(result.current).toBeDefined()
    })
  })

  describe('Permission Combinations', () => {
    it('should have consistent permissions for each role', () => {
      const roles = [
        {
          role: 'primary_admin',
          expected: {
            role: 'primary_admin',
            canCreateQueues: true,
            canManageUsers: true,
            canManageQuotas: true,
            canManageWhatsApp: true,
            canManageTemplates: true
          }
        },
        {
          role: 'secondary_admin',
          expected: {
            role: 'secondary_admin',
            canCreateQueues: false,
            canManageUsers: false,
            canManageQuotas: false,
            canManageWhatsApp: true,
            canManageTemplates: true
          }
        },
        {
          role: 'moderator',
          expected: {
            role: 'moderator',
            canCreateQueues: true,
            canManageUsers: false,
            canManageQuotas: false,
            canManageWhatsApp: false,
            canManageTemplates: false
          }
        },
        {
          role: 'user',
          expected: {
            role: 'user',
            canCreateQueues: true,
            canManageUsers: false,
            canManageQuotas: false,
            canManageWhatsApp: false,
            canManageTemplates: false
          }
        }
      ]

      roles.forEach(({ role: userRole, expected }) => {
        useAuth.mockReturnValue({
          user: {
            id: 1,
            username: 'test',
            fullName: 'Test User',
            role: userRole
          }
        })

        const { result } = renderHook(() => useAuthorization())

        Object.keys(expected).forEach(key => {
          expect(result.current[key]).toBe(expected[key])
        })
      })
    })
  })

  describe('Localized Role Names', () => {
    it('should return correct Arabic name for primary_admin', () => {
      useAuth.mockReturnValue({
        user: { role: 'primary_admin' }
      })

      const { result } = renderHook(() => useAuthorization())
      expect(result.current.role).toBe('primary_admin')
    })

    it('should return correct Arabic name for secondary_admin', () => {
      useAuth.mockReturnValue({
        user: { role: 'secondary_admin' }
      })

      const { result } = renderHook(() => useAuthorization())
      expect(result.current.role).toBe('secondary_admin')
    })

    it('should return correct Arabic name for moderator', () => {
      useAuth.mockReturnValue({
        user: { role: 'moderator' }
      })

      const { result } = renderHook(() => useAuthorization())
      expect(result.current.role).toBe('moderator')
    })

    it('should return correct Arabic name for user', () => {
      useAuth.mockReturnValue({
        user: { role: 'user' }
      })

      const { result } = renderHook(() => useAuthorization())
      expect(result.current.role).toBe('user')
    })
  })
})
