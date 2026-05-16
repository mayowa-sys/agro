import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { splitsQueue, deferralsQueue } from '../lib/queues';

export const squadWebhookRouter = Router();

/**
 * Squad VA-funding webhook payload (flat, per docs.squadco.com):
 *   transaction_reference, virtual_account_number, principal_amount,
 *   settled_amount, fee_charged, transaction_date, customer_identifier,
 *   transaction_indicator ("C"=credit), remarks, currency, channel,
 *   sender_name, meta, encrypted_body
 *
 * Amounts are strings in NAIRA (e.g. "0.20"), not integers in kobo.
 * We credit settled_amount (what actually landed after Squad's fee).
 */
async function handleWebhookPayload(payload: any) {
  // Squad VA webhook is flat — no Event wrapper. Identify by channel.
  const isVaFunding =
    payload?.channel === 'virtual-account' &&
    payload?.transaction_indicator === 'C' &&
    payload?.virtual_account_number;

  if (!isVaFunding) {
    return { processed: false, reason: 'Unhandled event (not a VA credit)' };
  }

  const eventId = payload.transaction_reference;
  if (!eventId) return { processed: false, reason: 'Missing transaction_reference' };

  // Idempotency
  const already = await redis.get(`webhook:${eventId}`);
  if (already) return { duplicate: true };
  await redis.set(`webhook:${eventId}`, '1', 'EX', 604800);

  const va = await prisma.virtualAccount.findUnique({
    where: { squadAccountNumber: payload.virtual_account_number },
    include: { farmer: { include: { inputDeferrals: { where: { status: 'ACTIVE' } } } } },
  });

  if (!va) {
    return { processed: false, reason: 'Unknown virtual account' };
  }

  // Squad sends settled_amount as a string in naira. Convert to kobo BigInt.
  const settledNaira = parseFloat(payload.settled_amount ?? payload.principal_amount ?? '0');
  const amountKobo = BigInt(Math.round(settledNaira * 100));

  const txn = await prisma.transaction.create({
    data: {
      virtualAccountId: va.id,
      squadReference: payload.transaction_reference,
      amount: amountKobo,
      type: 'CREDIT',
      source: 'HARVEST_PAYMENT',
      occurredAt: new Date(payload.transaction_date),
      rawWebhookPayload: payload,
    },
  });

  if (va.farmer && va.farmer.inputDeferrals.length > 0) {
    await deferralsQueue.add('collect-repayment', {
      transactionId: txn.id,
      farmerId: va.farmerId,
      amount: txn.amount.toString(),
    });
  } else {
    await splitsQueue.add('route', {
      transactionId: txn.id,
      farmerId: va.farmerId,
      amount: txn.amount.toString(),
    });
  }

  return { processed: true, transactionId: txn.id };
}

// POST /squad/webhook
squadWebhookRouter.post('/webhook', async (req: Request, res: Response) => {
  // Squad's current docs specify x-squad-encrypted-body; some older
  // accounts still send x-squad-signature. Accept either.
  const rawSig =
    (req.headers['x-squad-encrypted-body'] as string | undefined) ??
    (req.headers['x-squad-signature'] as string | undefined) ??
    '';

  const secret = process.env.SQUAD_WEBHOOK_SECRET ?? process.env.SQUAD_SECRET_KEY ?? '';
  if (!secret) return res.status(500).json({ error: 'Webhook secret not configured' });

  const expectedSig = crypto
    .createHmac('sha512', secret)
    .update(req.body)
    .digest('hex');

  // Squad's docs return uppercase hex; Node returns lowercase. Normalise both.
  const a = rawSig.toLowerCase();
  const b = expectedSig.toLowerCase();
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');

  const signaturesMatch =
    aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);

  if (!signaturesMatch) return res.status(401).json({ error: 'Invalid signature' });

  let payload: any;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    await handleWebhookPayload(payload);
  } catch (err) {
    console.error('Webhook processing error', err);
  }

  res.status(200).json({ ok: true });
});

// POST /squad/mock/trigger-webhook — dev only.
// Sends a Squad-shaped flat VA-funding payload to our own /squad/webhook,
// signed correctly so the real handler path is exercised end-to-end.
squadWebhookRouter.post('/mock/trigger-webhook', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).end();

  const { account_number, amount, transaction_ref } = req.body;
  const ref = transaction_ref ?? `mock-${Date.now()}`;
  const amountNaira = (Number(amount) / 100).toFixed(2);

  const payload = {
    transaction_reference: ref,
    virtual_account_number: account_number,
    principal_amount: amountNaira,
    settled_amount: amountNaira,
    fee_charged: '0.00',
    transaction_date: new Date().toISOString(),
    customer_identifier: 'MOCK_CUST',
    transaction_indicator: 'C',
    remarks: 'Mock inflow from simulate-payment',
    currency: 'NGN',
    channel: 'virtual-account',
    sender_name: 'MOCK SENDER',
    meta: {},
  };

  const raw = Buffer.from(JSON.stringify(payload));
  const secret = process.env.SQUAD_WEBHOOK_SECRET ?? process.env.SQUAD_SECRET_KEY ?? '';
  const signature = crypto.createHmac('sha512', secret).update(raw).digest('hex');

  const port = process.env.PORT ?? 3000;
  await axios.post(`http://localhost:${port}/squad/webhook`, raw, {
    headers: {
      'Content-Type': 'application/json',
      'x-squad-encrypted-body': signature,
    },
  });

  res.json({ triggered: true, signature, payload });
});
