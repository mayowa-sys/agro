import { Worker, Job } from 'bullmq';
import { redis, bullRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';
import { recomputeCreditScore } from '../services/credit-score.service';

interface SplitJobData {
  transactionId: string;
  farmerId: string;
  amount: string; // BigInt serialised as string
}

const worker = new Worker('splits', async (job: Job<SplitJobData>) => {
  const { transactionId, farmerId, amount } = job.data;

  const rule = await prisma.splitRule.findUnique({ where: { farmerId } });
  if (!rule) throw new Error(`No split rule for farmer ${farmerId}`);

  let total = BigInt(amount);
  const harvestTotal = total;

  // Load accounts first
  const accounts = await prisma.virtualAccount.findMany({ where: { farmerId } });
  const workingAccount = accounts.find(a => a.purpose === 'WORKING');
  const billsAccount      = accounts.find(a => a.purpose === 'BILLS');
  const nextSeasonAccount = accounts.find(a => a.purpose === 'NEXT_SEASON');

  if (!workingAccount || !billsAccount || !nextSeasonAccount) {
    throw new Error(`Virtual accounts not fully set up for farmer ${farmerId}`);
  }

  // ── Auto-repay AGRO input credits from harvest inflow ──────────────────
  const feePct = Number(process.env.AGRO_INPUT_CREDIT_FEE_PCT || '6');
  const activeCredits = await prisma.inputDeferral.findMany({
    where: {
      farmerId,
      status: 'DISBURSED',
      repaidAt: null,
    },
    orderBy: { expectedRepayBy: 'asc' },
  });

  let remainingAmount = total;
  for (const credit of activeCredits) {
    const feeKobo = credit.agroFee ?? (credit.amount * BigInt(feePct) / 100n);
    const totalDue = credit.amount + feeKobo;
    if (remainingAmount >= totalDue) {
      // Credit repayment: WORKING VA → AGRO float. Internal allocation,
      // both accounts are AGRO-owned, no real outbound transfer needed.
      // TODO(squad-live): if AGRO operates separate Squad wallets, replace
      //   with /payout/transfer to the float wallet's NUBAN.
      await prisma.virtualAccount.update({
        where: { id: workingAccount.id },
        data: { cachedBalance: { decrement: totalDue } },
      });

      await prisma.inputDeferral.update({
        where: { id: credit.id },
        data: { status: 'REPAID', repaidAt: new Date() },
      });

      // Trigger credit score recompute (fire-and-forget)
      recomputeCreditScore(farmerId).catch(err => console.warn('Credit score recompute failed:', err));

      remainingAmount -= totalDue;
    } else {
      break; // not enough to cover this credit
    }
  }

  // ── Liberation: middleman discount avoided = 30% of harvest inflow ─────
  // ONLY fires when the originating transaction is a genuine HARVEST_PAYMENT.
  // Other inflows (odd-job income, manual adjustments) route through splits
  // but should not inflate the liberation counter.
  const originatingTxn = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { source: true },
  });
  if (originatingTxn?.source === 'HARVEST_PAYMENT') {
    const middlemanAvoided = BigInt(Math.round(Number(harvestTotal) * 0.30));
    await prisma.liberationLog.create({
      data: {
        farmerId,
        source: 'MIDDLEMAN_DISCOUNT_AVOIDED',
        counterfactualLossKobo: middlemanAvoided,
        methodologyNote: `Harvest inflow: ₦${Number(harvestTotal / 100n)}. Counterfactual middleman discount estimated at 30% based on three peer-reviewed Nigerian agri value-chain studies (Kwara soybean 33.14%, South-South yam 42.1%, Gombe yam 28.28%) — ₦${Number(middlemanAvoided / 100n)} discount avoided. See /methodology.`,
      },
    });
  }

  // Use remaining amount for splits
  total = remainingAmount;

  // Skip splits under ₦1000 (100,000 kobo)
  if (total < 100000n) {
    await prisma.transaction.update({ where: { id: transactionId }, data: { processed: true } });
    return { skipped: true, reason: 'Amount below ₦1000 threshold or consumed by credit repayments' };
  }

  const billsAmount      = (total * BigInt(rule.billsPct)) / 100n;
  const nextSeasonAmount = (total * BigInt(rule.nextSeasonPct)) / 100n;
  const workingRemainder = total - billsAmount - nextSeasonAmount;

  // Split to Bills: WORKING → Bills VA. Both AGRO-owned, internal move.
  // TODO(squad-live): production should call /payout/transfer between the
  //   two GTBank wallets backing these VAs.
  if (billsAmount > 0n) {
    await prisma.virtualAccount.update({
      where: { id: billsAccount.id },
      data: { cachedBalance: { increment: billsAmount } },
    });
  }

  // Split to Next Season: WORKING → NextSeason VA. Internal move.
  // TODO(squad-live): same as Bills above.
  if (nextSeasonAmount > 0n) {
    await prisma.virtualAccount.update({
      where: { id: nextSeasonAccount.id },
      data: { cachedBalance: { increment: nextSeasonAmount } },
    });
  }

  // Working account keeps the remainder
  await prisma.virtualAccount.update({
    where: { id: workingAccount.id },
    data: { cachedBalance: { increment: workingRemainder } },
  });

  // Mark transaction processed. Don't overwrite source — the webhook
  // handler already set it correctly. Forcing HARVEST_PAYMENT here used to
  // make every routed inflow look like a harvest after the fact.
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { processed: true },
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
