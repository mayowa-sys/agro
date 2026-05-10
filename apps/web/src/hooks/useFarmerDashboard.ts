import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useFarmerDashboard = () =>
  useQuery({
    queryKey: ['farmer', 'dashboard'],
    queryFn: () => api.get('/accounts/dashboard').then(r => r.data),
  })
