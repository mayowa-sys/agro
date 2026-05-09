import { Worker, Job } from 'bullmq';
import { redis, bullRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';

interface SplitJobData {
  transactionId: string;
  farmerId: string;
  amount: string; // BigInt serialised as string
}

const worker = new Worker('splits', async (job: Job<SplitJobData>) => {
  const { transactionId, farmerId, amount } = job.data;

  const rule = await prisma.splitRule.findUnique({ where: { farmerId } });
  if (!rule) throw new Error(`No split rule for farmer ${farmerId}`);

  const total = BigInt(amount);

  // Skip splits under ₦1000 (100,000 kobo)
  if (total < 100000n) {
    await prisma.transaction.update({ where: { id: transactionId }, data: { processed: true } });
    return { skipped: true, reason: 'Amount below ₦1000 threshold' };
  }

  const billsAmount      = (total * BigInt(rule.billsPct)) / 100n;
  const nextSeasonAmount = (total * BigInt(rule.nextSeasonPct)) / 100n;
  // Working keeps the remainder — handles integer rounding
  const workingRemainder = total - billsAmount - nextSeasonAmount;

  const accounts = await prisma.virtualAccount.findMany({ where: { farmerId } });
  const billsAccount      = accounts.find(a => a.purpose === 'BILLS');
  const nextSeasonAccount = accounts.find(a => a.purpose === 'NEXT_SEASON');

  if (!billsAccount || !nextSeasonAccount) {
    throw new Error(`Virtual accounts not fully set up for farmer ${farmerId}`);
  }

  // Transfer to Bills
  if (billsAmount > 0n) {
    await squadClient.initiateTransfer({
      amount: Number(billsAmount) / 100,
      account_number: billsAccount.squadAccountNumber,
      bank_code: '058',
      currency_id: 'NGN',
      remark: `Agro split: BILLS - farmer ${farmerId}`,
    });
    await prisma.virtualAccount.update({
      where: { id: billsAccount.id },
      data: { cachedBalance: { increment: billsAmount } },
    });
  }

  // Transfer to Next Season
  if (nextSeasonAmount > 0n) {
    await squadClient.initiateTransfer({
      amount: Number(nextSeasonAmount) / 100,
      account_number: nextSeasonAccount.squadAccountNumber,
      bank_code: '058',
      currency_id: 'NGN',
      remark: `Agro split: NEXT_SEASON - farmer ${farmerId}`,
    });
    await prisma.virtualAccount.update({
      where: { id: nextSeasonAccount.id },
      data: { cachedBalance: { increment: nextSeasonAmount } },
    });
  }

  // Working account keeps the remainder — update its cache
  const workingAccount = accounts.find(a => a.purpose === 'WORKING');
  if (workingAccount) {
    await prisma.virtualAccount.update({
      where: { id: workingAccount.id },
      data: { cachedBalance: { increment: workingRemainder } },
    });
  }

  // Mark transaction processed
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { processed: true, source: 'HARVEST_PAYMENT' },
  });

  await prisma.auditLog.create({
    data: {
      action: 'SPLIT_EXECUTED',
      resource: 'Transaction',
      metadata: {
        transactionId,
        farmerId,
        total: total.toString(),
        billsAmount: billsAmount.toString(),
        nextSeasonAmount: nextSeasonAmount.toString(),
        workingRemainder: workingRemainder.toString(),
      },
    },
  });

  return {
    total: total.toString(),
    billsAmount: billsAmount.toString(),
    nextSeasonAmount: nextSeasonAmount.toString(),
    workingRemainder: workingRemainder.toString(),
  };
}, { connection: bullRedis });

worker.on('completed', (job, result) => {
  console.log(`[splits] job ${job.id} completed`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[splits] job ${job?.id} failed`, err.message);
});

export { worker as splitsWorker };
