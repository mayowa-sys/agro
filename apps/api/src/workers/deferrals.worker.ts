import { Worker } from 'bullmq';
import { bullRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';
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

    const transferResult = await squadClient.initiateTransfer({
      amount: Number(deferral.amount) / 100,
      account_number: deferral.supplier.squadAccountNumber,
      bank_code: '058',
      currency_id: 'NGN',
      remark: `Agro deferral disbursement: ${deferralId}`,
    });

    const mandateResult = await squadClient.createMandate({
      account_number: workingAccount.squadAccountNumber,
      amount: Number(deferral.amount + deferral.agroFee) / 100,
      remark: `Agro deferral repayment: ${deferralId}`,
    });

    await prisma.inputDeferral.update({
      where: { id: deferralId },
      data: {
        status: 'ACTIVE',
        disbursedAt: new Date(),
        squadMandateId: mandateResult.mandate_id,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DEFERRAL_DISBURSED',
        resource: 'InputDeferral',
        metadata: {
          deferralId,
          transferRef: transferResult.transaction_reference,
          mandateId: mandateResult.mandate_id,
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

    if (deferral.squadMandateId) {
      await squadClient.chargeMandate(deferral.squadMandateId, Number(repayAmount) / 100);
    }

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

    // Route remainder to splits after deferral repayment
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
