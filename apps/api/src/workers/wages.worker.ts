import { Worker, Job } from 'bullmq';
import { bullRedis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';
import logger from '../lib/logger';
import { wagesQueue } from '../lib/queues';

const PREMIUM_PCT = parseFloat(process.env.LIBERATION_LABOUR_PREMIUM_PCT || '10');

// Clean up failed jobs older than 1 hour on startup
wagesQueue.clean(3600 * 1000, 0, 'failed').catch(() => {});

export const wagesWorker = new Worker(
    'wages',
    async (job: Job<{ gigId: string }>) => {
        const { gigId } = job.data;
        console.error(`[WAGES WORKER] START gig ${gigId}`);
        try {
            logger.info(`Wage worker: processing gig ${gigId}`);

            // 1. Load gig
            const gig = await prisma.gig.findUnique({
                where: { id: gigId },
                include: {
                    job: { include: { farmer: { include: { user: true } } } },
                    labourer: { include: { user: true } },
                },
            });

            if (!gig) {
                console.error(`[WAGES WORKER] gig ${gigId} not found`);
                throw new Error('Gig not found');
            }

            if (gig.status !== 'BOTH_CONFIRMED') {
                console.error(`[WAGES WORKER] gig ${gigId} status ${gig.status}, skipping`);
                return { skipped: true, reason: 'Not both confirmed' };
            }

            // Idempotency
            const existingTransfer = await prisma.wageTransfer.findUnique({ where: { gigId } });
            if (existingTransfer?.status === 'SUCCEEDED') {
                console.error(`[WAGES WORKER] gig ${gigId} already paid`);
                return { skipped: true, reason: 'Already paid' };
            }

            // 2. Get VAs
            const farmerWorkingVA = await prisma.virtualAccount.findFirst({
                where: { farmerId: gig.job.farmerId, purpose: 'WORKING' },
            });
            console.error(`[WAGES WORKER] farmer VA: ${farmerWorkingVA?.id}`);

            const labourerSavingsVA = await prisma.virtualAccount.findFirst({
                where: { userId: gig.labourer.userId, purpose: 'LABOUR_SAVINGS' },
            });
            console.error(`[WAGES WORKER] labourer VA: ${labourerSavingsVA?.id}`);

            if (!farmerWorkingVA) throw new Error('Farmer working VA not found');
            if (!labourerSavingsVA) throw new Error('Labourer savings VA not found');

            // 3. Create pending WageTransfer
            const wageTransfer = await prisma.wageTransfer.create({
                data: {
                    gigId,
                    fromVirtualAccountId: farmerWorkingVA.id,
                    toVirtualAccountId: labourerSavingsVA.id,
                    amountKobo: gig.agreedAmountKobo,
                    status: 'PENDING',
                },
            });
            console.error(`[WAGES WORKER] wageTransfer created: ${wageTransfer.id}`);

            // 4. Deduct outstanding wage advance if any
            let payableKobo = BigInt(gig.agreedAmountKobo);
            const outstandingAdvance = await prisma.wageAdvance.findFirst({
                where: { labourerId: gig.labourerId, status: 'APPROVED' },
            });
            if (outstandingAdvance) {
                const deductKobo = (outstandingAdvance.approvedKobo ?? 0n) - outstandingAdvance.repaidKobo;
                const actualDeduct = deductKobo > payableKobo ? payableKobo : deductKobo;
                payableKobo = payableKobo - actualDeduct;
                const newRepaid = outstandingAdvance.repaidKobo + actualDeduct;
                const fullyRepaid = newRepaid >= (outstandingAdvance.approvedKobo ?? 0n);
                await prisma.wageAdvance.update({
                    where: { id: outstandingAdvance.id },
                    data: {
                        repaidKobo: newRepaid,
                        status: fullyRepaid ? 'REPAID' : 'APPROVED',
                        fullyRepaidAt: fullyRepaid ? new Date() : null,
                    },
                });
                console.error(`[WAGES WORKER] advance deduction: ${actualDeduct} kobo, remaining payable: ${payableKobo}`);
            }

            // 5. Wage allocation: farmer's WORKING → labourer's LABOUR_SAVINGS VA.
            // Both VAs are AGRO-owned, so this is an internal allocation, not
            // a real outbound bank transfer. In production, paying out to the
            // labourer's external bank account would require collecting their
            // NUBAN during onboarding (currently not in the Labourer schema).
            //
            // TODO(squad-live): when Labourer model carries bankAccountNumber
            //   + bankCode + verified accountName, fire /payout/transfer here.
            const amountNaira = Number(payableKobo) / 100;
            console.error(`[WAGES WORKER] allocating wage: ${amountNaira} NGN (internal)`);
            await prisma.virtualAccount.update({
                where: { id: labourerSavingsVA.id },
                data: { cachedBalance: { increment: payableKobo } },
            });
            const transferResult = {
                transaction_reference: `internal_wage_${gigId}`,
                status: 'SUCCESS' as const,
            };
            console.error(`[WAGES WORKER] wage allocation result: ${JSON.stringify(transferResult)}`);

            // 5. Success
            await prisma.wageTransfer.update({
                where: { id: wageTransfer.id },
                data: {
                    status: 'SUCCEEDED',
                    squadTransferRef: transferResult.transaction_reference,
                    succeededAt: new Date(),
                },
            });

            await prisma.gig.update({
                where: { id: gigId },
                data: { status: 'PAID', paidAt: new Date(), wageTransferId: wageTransfer.id },
            });

            await prisma.labourer.update({
                where: { id: gig.labourerId },
                data: {
                    totalEarnedKobo: { increment: gig.agreedAmountKobo },
                    totalGigsCompleted: { increment: 1 },
                },
            });
            // Update VA cached balances
            await prisma.virtualAccount.update({
                where: { id: farmerWorkingVA.id },
                data: { cachedBalance: { decrement: payableKobo } },
            });
            await prisma.virtualAccount.update({
                where: { id: labourerSavingsVA.id },
                data: { cachedBalance: { increment: payableKobo } },
            });

            const premiumKobo = BigInt(Math.floor(Number(gig.agreedAmountKobo) * PREMIUM_PCT / 100));
            await prisma.liberationLog.create({
                data: {
                    farmerId: gig.job.farmerId,
                    counterfactualLossKobo: premiumKobo,
                    source: 'CASH_ON_DAY_PREMIUM_CAPTURED',
                    gigId,
                    methodologyNote: `Cash-on-day premium captured: ₦${Number(gig.agreedAmountKobo / 100n)} wage × 10% = ₦${Number(premiumKobo / 100n)}. AGRO estimates a 10% premium for guaranteed same-day payment vs delayed/informal payment. Based on SBM Intelligence (2021): 40% of 3,416 informal-sector workers surveyed were owed wages, with delays up to 20 months. See /methodology.`,
                },
            });

            console.error(`[WAGES WORKER] SUCCESS gig ${gigId}. Premium: ${premiumKobo}`);
            return { success: true, gigId };
        } catch (err: any) {
            console.error(`[WAGES WORKER] ERROR gig ${gigId}:`, err?.message, err?.stack);
            // Update WageTransfer to FAILED if it was created
            try {
                const wt = await prisma.wageTransfer.findUnique({ where: { gigId } });
                if (wt && wt.status === 'PENDING') {
                    await prisma.wageTransfer.update({
                        where: { id: wt.id },
                        data: { status: 'FAILED', errorMessage: err?.message ?? 'Unknown error' },
                    });
                }
            } catch (updateErr) {
                console.error(`[WAGES WORKER] Failed to update WageTransfer to FAILED:`, updateErr);
            }
            throw err;
        }
    },
    {
        connection: bullRedis,
        concurrency: 1,
    }
);