import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Supplier {
  id: string;
  name: string;
  contactPhone: string;
  squadAccountNumber: string;
  region: string;
  active: boolean;
}

export interface Deferral {
  id: string;
  farmerId: string;
  supplierId: string;
  amount: string;
  agroFee: string;
  status: 'PENDING' | 'ACTIVE' | 'REPAID' | 'DEFAULTED' | 'CANCELLED';
  expectedRepayBy: string;
  disbursedAt: string | null;
  repaidAt: string | null;
  createdAt: string;
  supplier: Supplier;
}

export interface CreateDeferralPayload {
  supplierId: string;
  amount: number; // naira — backend handles kobo conversion
  expectedHarvestDate: string;
  notes?: string;
}

export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/deferrals/suppliers').then((r) => r.data),
  });
}

export function useMyDeferrals() {
  return useQuery<Deferral[]>({
    queryKey: ['deferrals'],
    queryFn: () => api.get('/deferrals/me').then((r) => r.data),
  });
}

export function useCreateDeferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDeferralPayload) =>
        api
            .post('/deferrals', {
              supplierId: payload.supplierId,
              amount: payload.amount,
              expectedRepayDate: payload.expectedHarvestDate,
              notes: payload.notes,
            })
            .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deferrals'] }),
  });
}
