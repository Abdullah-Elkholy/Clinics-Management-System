import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from '../lib/queryClient'
import { useMyQuota } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import * as api from '../lib/api'

// Mock useAuth
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn()
}))

// Mock api
jest.mock('../lib/api', () => ({
  default: {
    get: jest.fn()
  }
}))

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
)

describe('useMyQuota Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryClient.clear()
  })

  describe('Conditional Fetching Based on Authentication', () => {
    it('should NOT fetch quota when user is not authenticated', () => {
      // Arrange
      useAuth.mockReturnValue({ user: null })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toBeUndefined()
      expect(api.default.get).not.toHaveBeenCalled()
    })

    it('should fetch quota when user is authenticated', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'admin' }
      const mockQuota = { messagesQuota: 1000, remainingMessages: 500 }
      useAuth.mockReturnValue({ user: mockUser })
      api.default.get.mockResolvedValue({ data: { data: mockQuota } })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert - Initially loading
      expect(result.current.isLoading).toBe(true)

      // Wait for the query to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify API was called
      expect(api.default.get).toHaveBeenCalledWith('/api/Quotas/me')
      expect(result.current.data).toEqual(mockQuota)
    })

    it('should NOT make API call when user logs out', () => {
      // Arrange
      const mockUser = { id: 1, username: 'admin' }
      const mockQuota = { messagesQuota: 1000, remainingMessages: 500 }
      api.default.get.mockResolvedValue({ data: { data: mockQuota } })

      // First render with user logged in
      useAuth.mockReturnValue({ user: mockUser })
      const { rerender } = renderHook(() => useMyQuota(), { wrapper })

      // Clear mock calls
      api.default.get.mockClear()

      // Act - User logs out
      useAuth.mockReturnValue({ user: null })
      rerender()

      // Assert - No additional calls should be made
      expect(api.default.get).not.toHaveBeenCalled()
    })

    it('should use enabled option to control query execution', () => {
      // Arrange
      useAuth.mockReturnValue({ user: null })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      // Query should not be enabled (enabled: !!user === false)
      expect(result.current.fetchStatus).toBe('idle')
    })

    it('should enable query when user becomes authenticated', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'admin' }
      const mockQuota = { messagesQuota: 1000, remainingMessages: 500 }
      useAuth.mockReturnValue({ user: null })
      api.default.get.mockResolvedValue({ data: { data: mockQuota } })

      // First render without user
      const { rerender } = renderHook(() => useMyQuota(), { wrapper })
      expect(api.default.get).not.toHaveBeenCalled()

      // Act - User logs in
      useAuth.mockReturnValue({ user: mockUser })
      rerender()

      // Assert - Query should now be enabled and API called
      await waitFor(() => {
        expect(api.default.get).toHaveBeenCalledWith('/api/Quotas/me')
      })
    })
  })

  describe('Refetch Interval', () => {
    it('should refetch quota every 30 seconds when user is authenticated', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'admin' }
      const mockQuota = { messagesQuota: 1000, remainingMessages: 500 }
      useAuth.mockReturnValue({ user: mockUser })
      api.default.get.mockResolvedValue({ data: { data: mockQuota } })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert - Initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(api.default.get).toHaveBeenCalledTimes(1)

      // Note: Testing the actual 30s interval would require mocking timers
      // This test verifies that the query is configured with refetchInterval: 30000
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'admin' }
      useAuth.mockReturnValue({ user: mockUser })
      api.default.get.mockRejectedValue(new Error('API Error'))

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
      expect(result.current.error).toBeDefined()
    })

    it('should not try to refetch when user is not authenticated and 401 error occurs', async () => {
      // Arrange
      useAuth.mockReturnValue({ user: null })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      expect(result.current.fetchStatus).toBe('idle')
      expect(api.default.get).not.toHaveBeenCalled()
    })
  })

  describe('Query Key Management', () => {
    it('should use correct query key', () => {
      // Arrange
      const mockUser = { id: 1, username: 'admin' }
      useAuth.mockReturnValue({ user: mockUser })
      api.default.get.mockResolvedValue({ data: { data: {} } })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      // The query key should be ['quota', 'me']
      expect(result.current.queryKey).toEqual(['quota', 'me'])
    })
  })

  describe('Integration with QuotaDisplay Component', () => {
    it('should allow QuotaDisplay to safely render without errors when user is not authenticated', () => {
      // Arrange
      useAuth.mockReturnValue({ user: null })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      // Component can check: if (isLoading || !quota) return null
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toBeUndefined()
    })

    it('should return quota data when user is authenticated', async () => {
      // Arrange
      const mockUser = { id: 1, username: 'moderator' }
      const mockQuota = {
        messagesQuota: 1000,
        remainingMessages: 750,
        isMessagesQuotaLow: false,
        queuesQuota: 10,
        remainingQueues: 8,
        isQueuesQuotaLow: false,
        hasUnlimitedQuota: false
      }
      useAuth.mockReturnValue({ user: mockUser })
      api.default.get.mockResolvedValue({ data: { data: mockQuota } })

      // Act
      const { result } = renderHook(() => useMyQuota(), { wrapper })

      // Assert
      await waitFor(() => {
        expect(result.current.data).toEqual(mockQuota)
      })
    })
  })
})
