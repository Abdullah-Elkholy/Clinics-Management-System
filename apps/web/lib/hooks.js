import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'
import { useAuth } from './auth'

// --- Queues ---
export const useQueues = () => useQuery({
  queryKey: ['queues'],
  queryFn: () => api.get('/api/Queues').then(res => res.data.data || res.data)
})

export const useQueue = (id) => useQuery({
  queryKey: ['queues', id],
  queryFn: () => api.get(`/api/Queues/${id}`).then(res => res.data.data || res.data),
  enabled: !!id
})

export const useAddQueue = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newQueue) => api.post('/api/Queues', newQueue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] })
    },
  })
}

export const useUpdateQueue = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (queue) => api.put(`/api/Queues/${queue.id}`, queue),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      queryClient.invalidateQueries({ queryKey: ['queues', variables.id] })
    },
  })
}

export const useDeleteQueue = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (queueId) => api.delete(`/api/Queues/${queueId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] })
    },
  })
}

// --- Patients ---
export const usePatients = (queueId) => useQuery({
  queryKey: ['patients', queueId],
  queryFn: () => api.get(`/api/Queues/${queueId}/patients`).then(res => res.data.patients || res.data.data || res.data),
  enabled: !!queueId
})

export const useAddPatient = (queueId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newPatient) => api.post(`/api/Queues/${queueId}/patients`, newPatient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues'] }) // also invalidate queues to update patient count
    },
  })
}

export const useUpdatePatient = (queueId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patient) => api.put(`/api/Queues/${queueId}/patients/${patient.id}`, patient),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues', queueId] })
    },
  })
}

export const useDeletePatient = (queueId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patientId) => api.delete(`/api/Queues/${queueId}/patients/${patientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
    },
  })
}

// --- Templates ---
export const useTemplates = () => useQuery({
  queryKey: ['templates'],
  queryFn: () => api.get('/api/Templates').then(res => res.data.data || res.data.templates || [])
})

export const useAddTemplate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newTemplate) => api.post('/api/Templates', newTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (template) => api.put(`/api/Templates/${template.id}`, template),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      queryClient.invalidateQueries({ queryKey: ['templates', variables.id] })
    },
  })
}

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (templateId) => api.delete(`/api/Templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

// --- Messages ---
export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ templateId, patientIds, overrideContent }) => {
      const { data } = await api.post('/Messages/send', { templateId, patientIds, overrideContent })
      return data
    }
  })
}

// --- Users ---
export const useUsers = () => useQuery({
  queryKey: ['users'],
  queryFn: () => api.get('/api/Users').then(res => res.data.data || res.data)
})

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (user) => api.put(`/api/Users/${user.id}`, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

// --- Auth ---
export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials) => api.post('/api/Auth/login', credentials).then(res => res.data),
    onSuccess: (data) => {
      // Assuming the API returns the token in data.data.accessToken
      const token = data?.data?.accessToken
      if (token) {
        // You might want to store the token in localStorage or a cookie here
        // For example: localStorage.setItem('token', token)
      }
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/api/Auth/logout').then(res => res.data),
    onSuccess: () => {
      // Clear user session, e.g., remove token from storage
      // localStorage.removeItem('token')
      queryClient.clear()
    },
  })
}

// --- Ongoing Sessions ---
export const useOngoingSessions = () => useQuery({
  queryKey: ['sessions', 'ongoing'],
  queryFn: () => api.get('/api/Sessions/ongoing').then(res => res.data.data || []),
  refetchInterval: 5000, // Poll every 5 seconds for real-time updates
})

export const usePauseSession = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId) => api.post(`/api/Sessions/${sessionId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', 'ongoing'] })
    },
  })
}

export const useResumeSession = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId) => api.post(`/api/Sessions/${sessionId}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', 'ongoing'] })
    },
  })
}

export const useDeleteSession = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId) => api.delete(`/api/Sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', 'ongoing'] })
    },
  })
}

// --- Failed Tasks ---
export const useFailedTasks = () => useQuery({
  queryKey: ['tasks', 'failed'],
  queryFn: () => api.get('/api/Tasks/failed').then(res => res.data.data || []),
})

export const useRetryTasks = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskIds) => api.post('/api/Tasks/retry', { taskIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'failed'] })
      queryClient.invalidateQueries({ queryKey: ['sessions', 'ongoing'] })
    },
  })
}

export const useDeleteFailedTasks = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskIds) => api.delete('/api/Tasks/failed', { data: { taskIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'failed'] })
    },
  })
}

// ========================================
// Quota Management Hooks
// ========================================

/**
 * Get current user's quota (their moderator's quota if they're a user)
 * Only fetches if user is authenticated AND auth initialization is complete
 */
export const useMyQuota = () => {
  const { user, isLoading: userIsLoading, isReady: authReady } = useAuth()
  
  // Don't fetch until:
  // 1. Auth provider has determined if there's a user or not (authReady)
  // 2. User is actually authenticated (!!user)
  // 3. User query is not still loading
  const shouldFetch = authReady && !!user && !userIsLoading
  
  return useQuery({
    queryKey: ['quota', 'me'],
    queryFn: () => api.get('/api/Quotas/me').then(res => res.data.data),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: shouldFetch,
    retry: 2, // Retry twice on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })
}

/**
 * Get all quotas (admin only)
 */
export const useAllQuotas = () => useQuery({
  queryKey: ['quotas', 'all'],
  queryFn: () => api.get('/api/Quotas').then(res => res.data.data || []),
})

/**
 * Add quota to moderator (admin only)
 */
export const useAddQuota = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ moderatorId, addMessages, addQueues }) => 
      api.post(`/api/Quotas/${moderatorId}/add`, { addMessages, addQueues }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] })
      queryClient.invalidateQueries({ queryKey: ['quota', 'me'] })
    },
  })
}

/**
 * Update moderator quota (admin only)
 */
export const useUpdateQuota = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ moderatorId, messagesQuota, queuesQuota }) => 
      api.put(`/api/Quotas/${moderatorId}`, { messagesQuota, queuesQuota }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] })
      queryClient.invalidateQueries({ queryKey: ['quota', 'me'] })
    },
  })
}
