import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { splitsQueue, deferralsQueue } from '../lib/queues';

export const squadWebhookRouter = Router();

async function handleWebhookPayload(payload: any) {
  const eventId = payload.Event_Id ?? payload.transaction_ref;

  // Idempotency
  const already = await redis.get(`webhook:${eventId}`);
  if (already) return { duplicate: true };
  await redis.set(`webhook:${eventId}`, '1', 'EX', 604800);

  if (payload.Event === 'virtual_account_was_funded') {
    const va = await prisma.virtualAccount.findUnique({
      where: { squadAccountNumber: payload.Body.account_number },
      include: { farmer: { include: { inputDeferrals: { where: { status: 'ACTIVE' } } } } },
    });

    if (va) {
      const txn = await prisma.transaction.create({
        data: {
          virtualAccountId: va.id,
          squadReference: payload.Body.transaction_ref,
          amount: BigInt(Math.round(payload.Body.amount * 100)),
          type: 'CREDIT',
          source: 'HARVEST_PAYMENT',
          occurredAt: new Date(payload.Body.transaction_date),
          rawWebhookPayload: payload,
        },
      });

      if (va.farmer && va.farmer.inputDeferrals.length > 0) {
        await deferralsQueue.add('collect-repayment', { transactionId: txn.id, farmerId: va.farmerId, amount: txn.amount.toString() });
      } else {
        await splitsQueue.add('route', {
          transactionId: txn.id,
          farmerId: va.farmerId,
          amount: txn.amount.toString(),
        });
      }

      return { processed: true, transactionId: txn.id };
    }
  }

  return { processed: false, reason: 'Unhandled event or unknown account' };
}

// POST /squad/webhook
squadWebhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['x-squad-signature'] as string;
  const expectedSig = crypto
    .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET!)
    .update(req.body)
    .digest('hex');

  const sigBuffer      = Buffer.from(signature ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expectedSig, 'utf8');
  const signaturesMatch =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!signaturesMatch) return res.status(401).json({ error: 'Invalid signature' });

  const payload = JSON.parse(req.body.toString());

  try {
    await handleWebhookPayload(payload);
  } catch (err) {
    console.error('Webhook processing error', err);
  }

  res.status(200).json({ ok: true });
});

// POST /squad/mock/trigger-webhook — dev only
squadWebhookRouter.post('/mock/trigger-webhook', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).end();

  const { account_number, amount, transaction_ref } = req.body;
  const ref = transaction_ref ?? `mock-${Date.now()}`;

  const payload = {
    Event: 'virtual_account_was_funded',
    Event_Id: ref,
    Body: {
      account_number,
      amount,
      transaction_ref: ref,
      transaction_date: new Date().toISOString(),
    },
  };

  const raw = Buffer.from(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET!)
    .update(raw)
    .digest('hex');

  // Actually POST to our own webhook endpoint
  const port = process.env.PORT ?? 3000;
  await axios.post(`http://localhost:${port}/squad/webhook`, raw, {
    headers: {
      'Content-Type': 'application/json',
      'x-squad-signature': signature,
    },
  });

  res.json({ triggered: true, signature, payload });
});
