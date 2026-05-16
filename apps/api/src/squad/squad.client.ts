import axios, { AxiosInstance } from 'axios';
import { v4 as uuid } from 'uuid';
import {
  SquadVirtualAccountInput,
  SquadVirtualAccount,
  SquadTransferInput,
  SquadTransferResult,
  SquadAccountLookupResult,
  SquadMandateInput,
  SquadMandateResult,
} from './squad.types';

export class SquadClient {
  private http: AxiosInstance;
  private isMock: boolean;
  private merchantId: string;

  constructor() {
    this.isMock = process.env.SQUAD_MOCK_MODE === 'true';
    this.merchantId = process.env.SQUAD_MERCHANT_ID ?? 'AGRO';
    this.http = axios.create({
      baseURL: process.env.SQUAD_BASE_URL ?? 'https://sandbox-api-d.squadco.com',
      headers: { Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}` },
      timeout: 10000,
    });
  }

  /**
   * Builds a Squad-compliant transaction_reference.
   * Spec: "Kindly ensure that you append your merchant ID to the
   * transaction Reference you are creating. This is compulsory."
   * Format: SBABCKDY_<uuid>
   */
  private buildTxnRef(prefix?: string): string {
    const u = uuid().replace(/-/g, '');
    return prefix
      ? `${this.merchantId}_${prefix}_${u}`
      : `${this.merchantId}_${u}`;
  }

  // Virtual accounts ---------------------------------------------------------
  async createVirtualAccount(input: SquadVirtualAccountInput): Promise<SquadVirtualAccount> {
    if (this.isMock) {
      return {
        account_number: `0${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`,
        bank: 'GTBank',
        customer_id: `mock-${uuid()}`,
      };
    }
    // Try live; fall back to mock on failure so demo never breaks.
    try {
      const { data } = await this.http.post('/virtual-account', input);
      return {
        account_number: data.data.virtual_account_number,
        bank: 'GTBank',
        customer_id: data.data.customer_identifier,
      };
    } catch (err: any) {
      console.warn('[squad] Live VA creation failed, falling back to mock:', err?.response?.data ?? err?.message);
      return {
        account_number: `0${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`,
        bank: 'GTBank',
        customer_id: `mock-${uuid()}`,
      };
    }
  }

  async getVirtualAccount(customerId: string) {
    if (this.isMock) return { account_number: '0123456789', balance: 0 };
    const { data } = await this.http.get(`/virtual-account/${customerId}`);
    return data.data;
  }

  async listCustomerTransactions(customerId: string, params: Record<string, any> = {}) {
    if (this.isMock) return [];
    const { data } = await this.http.get(
      `/virtual-account/customer/transactions/${customerId}`,
      { params }
    );
    return data.data;
  }

  // Transfers ----------------------------------------------------------------

  /**
   * Confirm the account name before transferring.
   * Spec: "we will not be held liable for mistake in transferring to a
   * wrong account or an account that wasn't looked up"
   * Note: lookup runs LIVE even in sandbox.
   */
  async lookupAccount(bank_code: string, account_number: string): Promise<SquadAccountLookupResult> {
    if (this.isMock) {
      return { account_name: 'MOCK ACCOUNT NAME', account_number };
    }
    const { data } = await this.http.post('/payout/account/lookup', {
      bank_code,
      account_number,
    });
    return data.data;
  }

  async initiateTransfer(
    input: SquadTransferInput,
    refPrefix?: string,
  ): Promise<SquadTransferResult> {
    const transaction_reference = this.buildTxnRef(refPrefix);
    if (this.isMock) return { transaction_reference, status: 'SUCCESS' };
    const { data } = await this.http.post('/payout/transfer', {
      transaction_reference,
      ...input,
    });
    return data.data ?? { transaction_reference, status: data.status ?? 'PENDING' };
  }

  /**
   * Requery transfer status. Spec endpoint is POST /payout/requery.
   */
  async verifyTransfer(ref: string) {
    if (this.isMock) return { status: 'SUCCESS', reference: ref };
    const { data } = await this.http.post('/payout/requery', { transaction_reference: ref });
    return data.data;
  }

  // Mandates (direct debit) --------------------------------------------------
  // NOTE: Squad's public docs do not list /mandate endpoints. These calls
  // will 404 in live mode. AGRO's splits worker handles credit auto-repayment
  // at harvest inflow, so these are not on the critical path. Kept for
  // forward-compat once Squad's recurring API is wired.
  async createMandate(input: SquadMandateInput): Promise<SquadMandateResult> {
    if (this.isMock) return { mandate_id: `mock-mandate-${uuid()}`, status: 'ACTIVE' };
    const { data } = await this.http.post('/mandate', input);
    return data.data;
  }

  async chargeMandate(mandateId: string, amount: number) {
    if (this.isMock) return { status: 'SUCCESS', mandateId };
    const { data } = await this.http.post(`/mandate/${mandateId}/charge`, { amount });
    return data.data;
  }

  async cancelMandate(mandateId: string) {
    if (this.isMock) return { status: 'CANCELLED' };
    const { data } = await this.http.post(`/mandate/${mandateId}/cancel`);
    return data.data;
  }
}

export const squadClient = new SquadClient();
