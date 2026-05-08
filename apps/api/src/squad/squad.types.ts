export interface SquadVirtualAccountInput {
  customer_identifier: string;
  first_name: string;
  last_name: string;
  mobile_num: string;
  dob: string;
  bvn?: string;
}

export interface SquadVirtualAccount {
  account_number: string;
  bank: string;
  customer_id: string;
}

export interface SquadTransferInput {
  amount: number;
  account_number: string;
  bank_code: string;
  currency_id: string;
  remark: string;
}

export interface SquadTransferResult {
  transaction_reference: string;
  status: string;
}

export interface SquadMandateInput {
  [key: string]: any;
}

export interface SquadMandateResult {
  mandate_id: string;
  status: string;
}

export interface SquadWebhookPayload {
  Event: string;
  Event_Id: string;
  Body: {
    account_number: string;
    amount: number;
    transaction_ref: string;
    transaction_date: string;
    [key: string]: any;
  };
}
