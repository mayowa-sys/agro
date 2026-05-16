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

    // Factoring advance: AGRO float → farmer's WORKING VA.
    // This is an INTERNAL allocation between AGRO-owned accounts, not a
    // real outbound bank transfer. We update balances directly. In mock
    // mode we also keep a fake transferResult for downstream code.
    //
    // TODO(squad-live): if AGRO is ever profiled by Squad for inter-VA
    //   movements, replace this with a real /payout/transfer call.
    await prisma.virtualAccount.update({
      where: { id: workingAccount.id },
      data: { cachedBalance: { increment: advance.amount } },
    });
    const transferResult = { transaction_reference: `internal_factoring_${advanceId}`, status: 'SUCCESS' as const };

    // NOTE: factoring liberation is intentionally NOT logged here.
    // The methodology page documents two Liberation sources (middleman discount
    // and cash-on-day premium). A separate factoring counterfactual would need
    // its own LiberationSource enum value, its own methodology section, and a
    // defensible coefficient — none of which are in scope for the demo. The
    // factoring product itself still functions; only the misleading 45% under
    // MIDDLEMAN_DISCOUNT_AVOIDED row is removed.

    await prisma.factoringAdvance.update({
      where: { id: advanceId },
      data: {
        status: 'ADVANCED',
        advancedAt: new Date(),
        squadAdvanceTransferRef: transferResult.transaction_reference,
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
        },
      },
    });

    console.log(`Factoring advance ${advanceId} sent to farmer ${advance.farmerId}`);
  }

}, { connection: bullRedis });
