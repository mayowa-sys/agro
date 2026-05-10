import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ForecastResponse {
  id: string;
  modelVersion: string;
  events: Array<{
    date: string;
    type: 'INCOME' | 'EXPENSE' | 'NEUTRAL';
    amount: number;
    category: string;
    label?: string;
  }>;
}

export interface CashGapResponse {
  gaps: Array<{
    startDate: string;
    endDate: string;
    shortfallKobo: number;
  }>;
}

export function useForecast() {
  return useQuery<ForecastResponse>({
    queryKey: ['forecast', 'current'],
    queryFn: () =>
        api.get('/forecasts/me/current').then((r) => ({
          ...r.data,
          events: (r.data.events ?? []).map((e: any) => ({
            ...e,
            date: e.expectedDate,
            amount: Number(e.expectedAmount),
          })),
        })),
  });
}

export function useCashGaps() {
  return useQuery<CashGapResponse>({
    queryKey: ['forecast', 'cash-gaps'],
    queryFn: () => api.get('/forecasts/me/cash-gaps').then((r) => r.data),
  });
}

export function useRegenerateForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const [result] = await Promise.all([
        api.post('/forecasts/me/regenerate'),
        new Promise((r) => setTimeout(r, 1200)),
      ]);
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forecast'] }),
  });
}

export function useStressTest() {
  return useMutation({
    mutationFn: (scenario: string) =>
      api.post('/forecasts/me/stress-test', { scenario }).then((r) => r.data),
  });
}

export function useProjectedBalance() {
  return useQuery({
    queryKey: ['forecast', 'projected-balance'],
    queryFn: () => api.get('/forecasts/me/projected-balance').then(r => r.data),
  });
}
