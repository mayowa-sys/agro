import { Worker } from 'bullmq';
import { bullRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';

new Worker('factoring', async (job) => {

  if (job.name === 'advance') {
    const { advanceId } = job.data;

    const advance = await prisma.factoringAdvance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        farmer: { include: { virtualAccounts: true } },
      },
    });

    if (advance.status !== 'REQUESTED') {
      console.warn(`Advance ${advanceId} not REQUESTED (${advance.status}), skipping`);
      return;
    }

    const workingAccount = advance.farmer.virtualAccounts.find(va => va.purpose === 'WORKING');
    if (!workingAccount) throw new Error(`No WORKING account for farmer ${advance.farmerId}`);

    // Transfer advance amount to farmer's Working account
    const transferResult = await squadClient.initiateTransfer({
      amount: Number(advance.amount) / 100,
      account_number: workingAccount.squadAccountNumber,
      bank_code: '058',
      currency_id: 'NGN',
      remark: `Agro factoring advance: ${advanceId}`,
    });

    // Counterfactual loss = what farmer would have lost to exploitative middlemen
    // Assumed predatory buyer would pay 45% less than fair market value
    const totalDeliveryValue = advance.amount + advance.fee;
    const counterfactualLossKobo = (totalDeliveryValue * 45n) / 100n;

    await prisma.factoringAdvance.update({
      where: { id: advanceId },
      data: {
        status: 'ADVANCED',
        advancedAt: new Date(),
        squadAdvanceTransferRef: transferResult.transaction_reference,
      },
    });

    await prisma.liberationLog.create({
      data: {
        farmerId: advance.farmerId,
        factoringAdvanceId: advanceId,
        counterfactualLossKobo,
      },
    });

    // Update cached balance
    await prisma.virtualAccount.updateMany({
      where: { farmerId: advance.farmerId, purpose: 'WORKING' },
      data: { cachedBalance: { increment: advance.amount } },
    });

    await prisma.auditLog.create({
      data: {
        action: 'FACTORING_ADVANCED',
        resource: 'FactoringAdvance',
        metadata: {
          advanceId,
          transferRef: transferResult.transaction_reference,
          counterfactualLossKobo: counterfactualLossKobo.toString(),
        },
      },
    });

    console.log(`Factoring advance ${advanceId} sent to farmer ${advance.farmerId}, liberation logged: ₦${Number(counterfactualLossKobo) / 100}`);
  }

}, { connection: bullRedis });
