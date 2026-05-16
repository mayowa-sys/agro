import { Worker } from 'bullmq';
import { bullRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';
import { BANK_CODES } from '../squad/squad.banks';
import { splitsQueue } from '../lib/queues';

new Worker('deferrals', async (job) => {

  if (job.name === 'disburse') {
    const { deferralId } = job.data;

    const deferral = await prisma.inputDeferral.findUniqueOrThrow({
      where: { id: deferralId },
      include: {
        supplier: true,
        farmer: { include: { virtualAccounts: true } },
      },
    });

    if (deferral.status !== 'PENDING') {
      console.warn(`Deferral ${deferralId} not PENDING (${deferral.status}), skipping`);
      return;
    }

    const workingAccount = deferral.farmer.virtualAccounts.find(va => va.purpose === 'WORKING');
    if (!workingAccount) throw new Error(`No WORKING account for farmer ${deferral.farmerId}`);

    // AGRO float → supplier (real outbound). Lookup confirms account name.
    const supplierLookup = await squadClient.lookupAccount(
      BANK_CODES.GTBANK,
      deferral.supplier.squadAccountNumber,
    );

    const transferResult = await squadClient.initiateTransfer({
      amount: Number(deferral.amount), // kobo
      account_number: deferral.supplier.squadAccountNumber,
      account_name: supplierLookup.account_name,
      bank_code: BANK_CODES.GTBANK,
      currency_id: 'NGN',
      remark: `Agro deferral disbursement: ${deferralId}`,
    }, `defer_${deferralId}`);

    // NOTE: Squad's public API does not expose a mandate/direct-debit
    // endpoint. Auto-repayment is handled by the splits worker when the
    // harvest inflow lands on the farmer's WORKING VA — see
    // splits.worker.ts. We no longer create a Squad mandate here.

    await prisma.inputDeferral.update({
      where: { id: deferralId },
      data: {
        status: 'ACTIVE',
        disbursedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DEFERRAL_DISBURSED',
        resource: 'InputDeferral',
        metadata: {
          deferralId,
          transferRef: transferResult.transaction_reference,
        },
      },
    });

    console.log(`Deferral ${deferralId} disbursed to supplier ${deferral.supplier.name}`);
  }

  if (job.name === 'collect-repayment') {
    const { deferralId, farmerId, transactionId, manual } = job.data;

    let targetDeferralId = deferralId;
    if (!targetDeferralId && farmerId) {
      const deferral = await prisma.inputDeferral.findFirst({
        where: { farmerId, status: 'ACTIVE' },
        orderBy: { expectedRepayBy: 'asc' },
      });
      if (!deferral) return;
      targetDeferralId = deferral.id;
    }

    const deferral = await prisma.inputDeferral.findUniqueOrThrow({
      where: { id: targetDeferralId },
    });

    if (deferral.status !== 'ACTIVE') {
      console.warn(`Deferral ${targetDeferralId} not ACTIVE, skipping repayment`);
      return;
    }

    const repayAmount = deferral.amount + deferral.agroFee;

    // NOTE: mandate charge removed. The splits worker collects repayment
    // from the WORKING VA at harvest inflow. If this job fires manually
    // (via /deferrals/:id/repay-now or webhook fallback), we only update
    // the DB state and decrement balance — no Squad call needed because
    // both source (WORKING VA) and destination (AGRO float) are AGRO-owned.

    await prisma.inputDeferral.update({
      where: { id: targetDeferralId },
      data: { status: 'REPAID', repaidAt: new Date() },
    });

    await prisma.virtualAccount.updateMany({
      where: { farmerId: deferral.farmerId, purpose: 'WORKING' },
      data: { cachedBalance: { decrement: repayAmount } },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DEFERRAL_REPAID',
        resource: 'InputDeferral',
        metadata: {
          deferralId: targetDeferralId,
          transactionId: transactionId ?? null,
          manual: manual ?? false,
          repayAmount: repayAmount.toString(),
        },
      },
    });

    const remainder = (job.data.amount ? BigInt(job.data.amount) : 0n) - repayAmount;
    if (remainder > 100000n) {
      await splitsQueue.add('route', {
        transactionId: job.data.transactionId ?? null,
        farmerId: deferral.farmerId,
        amount: remainder.toString(),
      });
    }

    console.log(`Deferral ${targetDeferralId} repaid (manual: ${manual ?? false})`);
  }

}, { connection: bullRedis });
