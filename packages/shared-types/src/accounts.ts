export type AccountPurpose = 'WORKING' | 'BILLS' | 'NEXT_SEASON';

export interface VirtualAccount {
  id: string;
  farmerId: string;
  squadAccountNumber: string;
  squadCustomerId: string;
  bankName: string;
  purpose: AccountPurpose;
  cachedBalance: string; // BigInt serialised as string
  createdAt: string;
}

export interface Transaction {
  id: string;
  virtualAccountId: string;
  squadReference: string;
  amount: string; // BigInt as string
  type: 'CREDIT' | 'DEBIT';
  source: string;
  occurredAt: string;
  processed: boolean;
  createdAt: string;
}

export interface TransactionPage {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
