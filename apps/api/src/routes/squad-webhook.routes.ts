import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { splitsQueue, deferralsQueue } from '../lib/queues';
import { SquadWebhookPayload } from '../squad/squad.types';

export const squadWebhookRouter = Router();

// POST /squad/webhook
squadWebhookRouter.post('/webhook', async (req: Request, res: Response) => {
  // Signature verification
  const signature = req.headers['x-squad-signature'] as string ?? '';
  const expectedSig = crypto
    .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET!)
    .update(req.body as Buffer)
    .digest('hex');

  const sigBuffer      = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSig, 'utf8');
  const valid =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload: SquadWebhookPayload = JSON.parse((req.body as Buffer).toString());
  const eventId = payload.Event_Id ?? payload.Body?.transaction_ref;

  // Idempotency
  const already = await redis.get(`webhook:${eventId}`);
  if (already) return res.status(200).json({ ok: true });
  await redis.set(`webhook:${eventId}`, '1', 'EX', 604800);

  try {
    if (payload.Event === 'virtual_account_was_funded') {
      const va = await prisma.virtualAccount.findUnique({
        where: { squadAccountNumber: payload.Body.account_number },
        include: {
          farmer: {
            include: { inputDeferrals: { where: { status: 'ACTIVE' } } },
          },
        },
      });

      if (va) {
        const amountKobo = BigInt(Math.round(payload.Body.amount * 100));
        const txn = await prisma.transaction.create({
          data: {
            virtualAccountId:   va.id,
            squadReference:     payload.Body.transaction_ref,
            amount:             amountKobo,
            type:               'CREDIT',
            source:             'HARVEST_PAYMENT',
            occurredAt:         new Date(payload.Body.transaction_date),
            rawWebhookPayload:  payload,
          },
        });

        if (va.farmer.inputDeferrals.length > 0) {
          await deferralsQueue.add('collect-repayment', {
            transactionId: txn.id,
            farmerId: va.farmerId,
          });
        } else {
          await splitsQueue.add('route', {
            transactionId: txn.id,
            farmerId:      va.farmerId,
            amount:        txn.amount.toString(),
          });
        }
      }
    }
  } catch (err) {
    console.error('Webhook processing error', err);
    // Still return 200 — Squad will retry otherwise
  }

  return res.status(200).json({ ok: true });
});

// Mock trigger — dev only
squadWebhookRouter.post('/mock/trigger-webhook', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).end();

  const { account_number, amount, transaction_ref } = req.body;
  const ref = transaction_ref ?? `mock-${Date.now()}`;

  const fakePayload: SquadWebhookPayload = {
    Event:    'virtual_account_was_funded',
    Event_Id: ref,
    Body: {
      account_number,
      amount,
      transaction_ref: ref,
      transaction_date: new Date().toISOString(),
    },
  };

  const raw = Buffer.from(JSON.stringify(fakePayload));
  const sig = crypto
    .createHmac('sha512', process.env.SQUAD_WEBHOOK_SECRET!)
    .update(raw)
    .digest('hex');

  return res.json({ triggered: true, signature: sig, payload: fakePayload });
});
