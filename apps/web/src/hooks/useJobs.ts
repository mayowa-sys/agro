import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
export const useMyJobs = () =>
  useQuery({
    queryKey: ['jobs', 'me'],
    queryFn: () => api.get('/jobs/me').then(r => r.data),
  })

export const useMyGigs = (filter?: 'active' | 'completed') =>
  useQuery({
    queryKey: ['gigs', 'me', filter],
    queryFn: () => api.get('/gigs/me', { params: { filter } }).then(r => r.data),
  })

export const useCreateJob = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/jobs', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', 'me'] })
    },
  })
}

export const useConfirmGigDone = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/gigs/${id}/confirm-done`, { side: 'FARMER' }).then(r => r.data),
      onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['gigs', 'me'] })
          qc.invalidateQueries({ queryKey: ['labourer', 'dashboard'] })
      },
  })
}

export const useRateLabourer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, score, comment }: { id: string; score: number; comment?: string }) =>
      api.post(`/gigs/${id}/rate`, { score, comment }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gigs', 'me'] })
    },
  })
}

export const useGig = (id: string) =>
  useQuery({
    queryKey: ['gig', id],
    queryFn: () => api.get(`/gigs/${id}`).then(r => r.data),
    enabled: !!id,
  })
