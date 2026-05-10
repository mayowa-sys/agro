import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { wagesQueue } from '../lib/queues';
import { recomputeReputationTier } from './labourers.service';
import logger from '../lib/logger';

export async function getMyGigs(userId: string, role: string) {
  if (role === 'FARMER') {
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (!farmer) throw new AppError(404, 'Farmer profile not found');

    return prisma.gig.findMany({
      where: { job: { farmerId: farmer.id } },
      include: {
        job: { select: { id: true, title: true, expectedDate: true } },
        labourer: { select: { id: true, fullName: true, reputationTier: true, region: true } },
        rating: true,
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  if (role === 'LABOURER') {
    const labourer = await prisma.labourer.findUnique({ where: { userId } });
    if (!labourer) throw new AppError(404, 'Labourer profile not found');

    return prisma.gig.findMany({
      where: { labourerId: labourer.id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            expectedDate: true,
            farmer: { select: { id: true, name: true, region: true } },
          },
        },
        rating: true,
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  throw new AppError(400, 'Unknown role for gig listing');
}

export async function getGigById(gigId: string) {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          description: true,
          expectedDate: true,
          payAmountKobo: true,
          skillsRequired: true,
          farmer: { select: { id: true, name: true, region: true } },
        },
      },
      labourer: { select: { id: true, fullName: true, reputationTier: true, region: true } },
      rating: true,
      wageTransfer: true,
    },
  });
  if (!gig) throw new AppError(404, 'Gig not found');
  return gig;
}

export async function confirmGigDone(gigId: string, userId: string, role: string) {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { job: true, labourer: { include: { user: true } } },
  });
  if (!gig) throw new AppError(404, 'Gig not found');

  // Only ACCEPTED or single-confirmed gigs can be confirmed
  if (!['ACCEPTED', 'FARMER_CONFIRMED_DONE', 'LABOURER_CONFIRMED_DONE'].includes(gig.status)) {
    throw new AppError(400, `Cannot confirm gig in status: ${gig.status}`);
  }

  let newStatus = gig.status;

  if (role === 'FARMER') {
    // Verify farmer owns the job
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (!farmer || gig.job.farmerId !== farmer.id) {
      throw new AppError(403, 'Not your job');
    }
    if (gig.status === 'FARMER_CONFIRMED_DONE') {
      throw new AppError(400, 'Farmer already confirmed');
    }

    await prisma.gig.update({
      where: { id: gigId },
      data: { farmerConfirmedAt: new Date() },
    });

    if (gig.status === 'LABOURER_CONFIRMED_DONE') {
      newStatus = 'BOTH_CONFIRMED';
    } else {
      newStatus = 'FARMER_CONFIRMED_DONE';
    }
  } else if (role === 'LABOURER') {
    // Verify labourer owns the gig
    const labourer = await prisma.labourer.findUnique({ where: { userId } });
    if (!labourer || gig.labourerId !== labourer.id) {
      throw new AppError(403, 'Not your gig');
    }
    if (gig.status === 'LABOURER_CONFIRMED_DONE') {
      throw new AppError(400, 'Labourer already confirmed');
    }

    await prisma.gig.update({
      where: { id: gigId },
      data: { labourerConfirmedAt: new Date() },
    });

    if (gig.status === 'FARMER_CONFIRMED_DONE') {
      newStatus = 'BOTH_CONFIRMED';
    } else {
      newStatus = 'LABOURER_CONFIRMED_DONE';
    }
  } else {
    throw new AppError(400, 'Unknown role for confirmation');
  }

  await prisma.gig.update({
    where: { id: gigId },
    data: { status: newStatus },
  });

  // If both confirmed, trigger wage routing
  if (newStatus === 'BOTH_CONFIRMED') {
    const farmerWorkingVA = await prisma.virtualAccount.findFirst({
      where: { farmerId: gig.job.farmerId, purpose: 'WORKING' },
    });
    const labourerSavingsVA = await prisma.virtualAccount.findFirst({
      where: { userId: gig.labourer.userId, purpose: 'LABOUR_SAVINGS' },
    });
    if (!farmerWorkingVA || !labourerSavingsVA) {
      logger.error(`Cannot enqueue wage routing for gig ${gigId}: missing VAs (farmer: ${!!farmerWorkingVA}, labourer: ${!!labourerSavingsVA})`);
      throw new AppError(500, 'Cannot process wage transfer — virtual accounts not found. Contact support.');
    }
    await wagesQueue.add('route-wage', { gigId });
    logger.info(`Wage routing enqueued for gig ${gigId}`);
  }

  return { gigId, status: newStatus };
}

export async function cancelGig(gigId: string, userId: string, role: string, reason: string) {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { job: true },
  });
  if (!gig) throw new AppError(404, 'Gig not found');

  // Can only cancel ACCEPTED gigs (before any confirmation)
  if (gig.status !== 'ACCEPTED') {
    throw new AppError(400, `Cannot cancel gig in status: ${gig.status}. Contact support for disputes.`);
  }

  // Verify ownership
  if (role === 'FARMER') {
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (!farmer || gig.job.farmerId !== farmer.id) {
      throw new AppError(403, 'Not your job');
    }
  } else if (role === 'LABOURER') {
    const labourer = await prisma.labourer.findUnique({ where: { userId } });
    if (!labourer || gig.labourerId !== labourer.id) {
      throw new AppError(403, 'Not your gig');
    }
  } else {
    throw new AppError(400, 'Unknown role');
  }

  return prisma.gig.update({
    where: { id: gigId },
    data: { status: 'CANCELLED', cancelReason: reason },
  });
}

export async function rateGig(gigId: string, userId: string, role: string, data: {
  score: number;
  comment?: string;
}) {
  const gig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { rating: true },
  });
  if (!gig) throw new AppError(404, 'Gig not found');

  // Can only rate PAID or CLOSED gigs
  if (!['PAID', 'CLOSED'].includes(gig.status)) {
    throw new AppError(400, 'Can only rate completed gigs');
  }

  if (data.score < 1 || data.score > 5) {
    throw new AppError(400, 'Score must be 1–5');
  }

  if (role === 'FARMER') {
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (!farmer) throw new AppError(404, 'Farmer not found');

    // Upsert rating
    const rating = await prisma.rating.upsert({
      where: { gigId },
      update: {
        farmerScoreOfLabourer: data.score,
        farmerComment: data.comment ?? null,
      },
      create: {
        gigId,
        labourerId: gig.labourerId,
        farmerScoreOfLabourer: data.score,
        farmerComment: data.comment ?? null,
      },
    });

    // Recompute labourer reputation
    await recomputeReputationTier(gig.labourerId);

    return rating;
  }

  if (role === 'LABOURER') {
    const labourer = await prisma.labourer.findUnique({ where: { userId } });
    if (!labourer) throw new AppError(404, 'Labourer not found');
    if (gig.labourerId !== labourer.id) throw new AppError(403, 'Not your gig');

    const rating = await prisma.rating.upsert({
      where: { gigId },
      update: {
        labourerScoreOfFarmer: data.score,
        labourerComment: data.comment ?? null,
        raterLabourerId: labourer.id,
      },
      create: {
        gigId,
        labourerId: gig.labourerId,
        labourerScoreOfFarmer: data.score,
        labourerComment: data.comment ?? null,
        raterLabourerId: labourer.id,
      },
    });

    return rating;
  }

  throw new AppError(400, 'Unknown role for rating');
}
