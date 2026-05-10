import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useLabourerDashboard = () =>
  useQuery({
    queryKey: ['labourer', 'dashboard'],
    queryFn: () => api.get('/labourers/me/dashboard').then(r => r.data),
  })

export const useLabourerGigs = () =>
  useQuery({
    queryKey: ['labourer', 'gigs'],
    queryFn: () => api.get('/gigs/me').then(r => r.data),
  })

export const useOnboardLabourer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/labourers', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labourer'] }),
  })
}

export const useAcceptJob = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => api.post(`/jobs/${jobId}/accept`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labourer', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['labourer', 'gigs'] })
    },
  })
}

export const useLabourerConfirmDone = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gigId: string) => api.post(`/gigs/${gigId}/confirm-done`, { side: 'LABOURER' }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labourer', 'dashboard'] })
      qc.invalidateQueries({ queryKey: ['labourer', 'gigs'] })
    },
  })
}

export function useWageAdvances() {
  return useQuery({
    queryKey: ['wage-advances'],
    queryFn: () => api.get('/wage-advances/me').then(r => r.data),
  })
}
