import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'

// --- Queues ---
export const useQueues = () => useQuery({
  queryKey: ['queues'],
  queryFn: () => api.get('/api/queues').then(res => res.data.data || res.data)
})

export const useQueue = (id) => useQuery({
  queryKey: ['queues', id],
  queryFn: () => api.get(`/api/queues/${id}`).then(res => res.data.data || res.data),
  enabled: !!id
})

export const useAddQueue = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newQueue) => api.post('/api/queues', newQueue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] })
    }
  })
}

// --- Patients ---
export const usePatients = (queueId) => useQuery({
  queryKey: ['patients', queueId],
  queryFn: () => api.get(`/api/queues/${queueId}/patients`).then(res => res.data.data || res.data),
  enabled: !!queueId
})

export const useAddPatient = (queueId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newPatient) => api.post(`/api/queues/${queueId}/patients`, newPatient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues'] }) // also invalidate queues to update patient count
    }
  })
}

export const useUpdatePatient = (queueId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patient) => api.put(`/api/queues/${queueId}/patients/${patient.id}`, patient),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues', queueId] })
    }
  })
}

export const useDeletePatient = (queueId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patientId) => api.delete(`/api/queues/${queueId}/patients/${patientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', queueId] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
    }
  })
}

// --- Templates ---
export const useTemplates = () => useQuery({
  queryKey: ['templates'],
  queryFn: () => api.get('/api/templates').then(res => res.data.data || res.data)
})

export const useAddTemplate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (newTemplate) => api.post('/api/templates', newTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}

// --- Messages ---
export const useSendMessage = () => {
  return useMutation({
    mutationFn: (message) => api.post('/api/messages/send', message)
  })
}

// --- Users ---
export const useUsers = () => useQuery({
  queryKey: ['users'],
  queryFn: () => api.get('/api/users').then(res => res.data.data || res.data)
})

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (user) => api.put(`/api/users/${user.id}`, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })
}

// --- Auth ---
export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials) => api.post('/api/auth/login', credentials),
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
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      // Clear user session, e.g., remove token from storage
      // localStorage.removeItem('token')
      queryClient.clear()
    },
  })
}
