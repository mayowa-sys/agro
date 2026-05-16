export interface SquadVirtualAccountInput {
  customer_identifier: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  mobile_num: string;
  dob: string;
  email?: string;
  bvn?: string;
  gender?: '1' | '2';
  address?: string;
  beneficiary_account?: string;
}

export interface SquadVirtualAccount {
  account_number: string;
  bank: string;
  customer_id: string;
}

export interface SquadTransferInput {
  amount: number;             // in kobo
  bank_code: string;          // NIP code, e.g. "000013" for GTBank
  account_number: string;     // 10-digit NUBAN
  account_name: string;       // MUST match the result of /payout/account/lookup
  currency_id: string;        // "NGN"
  remark: string;
  // transaction_reference is auto-generated inside the client and prefixed
  // with SQUAD_MERCHANT_ID per Squad's spec.
}

export interface SquadTransferResult {
  transaction_reference: string;
  status: string;
}

export interface SquadAccountLookupResult {
  account_name: string;
  account_number: string;
}

export interface SquadMandateInput {
  [key: string]: any;
}

export interface SquadMandateResult {
  mandate_id: string;
  status: string;
}

export interface SquadWebhookPayload {
  transaction_reference: string;
  virtual_account_number: string;
  principal_amount: string;
  settled_amount: string;
  fee_charged: string;
  transaction_date: string;
  customer_identifier: string;
  transaction_indicator: 'C' | 'D';
  remarks: string;
  currency: string;
  channel: string;
  sender_name?: string;
  meta?: Record<string, any>;
}
