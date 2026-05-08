import axios, { AxiosInstance } from 'axios';
import { v4 as uuid } from 'uuid';
import {
  SquadVirtualAccountInput,
  SquadVirtualAccount,
  SquadTransferInput,
  SquadTransferResult,
  SquadMandateInput,
  SquadMandateResult,
} from './squad.types';

export class SquadClient {
  private http: AxiosInstance;
  private isMock: boolean;

  constructor() {
    this.isMock = process.env.SQUAD_MOCK_MODE === 'true';
    this.http = axios.create({
      baseURL: process.env.SQUAD_BASE_URL ?? 'https://sandbox-api-d.squadco.com',
      headers: { Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}` },
      timeout: 10000,
    });
  }

  // Virtual accounts
  async createVirtualAccount(input: SquadVirtualAccountInput): Promise<SquadVirtualAccount> {
    if (this.isMock) {
      return {
        account_number: `0${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`,
        bank: 'GTBank',
        customer_id: `mock-${uuid()}`,
      };
    }
    const { data } = await this.http.post('/virtual-account', input);
    return data.data;
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

  // Transfers
  async initiateTransfer(input: SquadTransferInput): Promise<SquadTransferResult> {
    const transaction_reference = uuid();
    if (this.isMock) return { transaction_reference, status: 'SUCCESS' };
    const { data } = await this.http.post('/payout/transfer', {
      ...input,
      transaction_reference,
    });
    return data.data;
  }

  async verifyTransfer(ref: string) {
    if (this.isMock) return { status: 'SUCCESS', reference: ref };
    const { data } = await this.http.get(`/payout/transfer/verify/${ref}`);
    return data.data;
  }

  // Mandates (direct debit)
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
