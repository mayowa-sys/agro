import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { aiClient } from '../lib/ai-client';
import logger from '../lib/logger';

export async function createJob(farmerId: string, data: {
  title: string;
  description?: string;
  skillsRequired: string[];
  expectedDate: string;
  durationDays: number;
  payAmountKobo: bigint;
  workersNeeded: number;
  sourceForecastEventId?: string;
}) {
  const job = await prisma.job.create({
    data: {
      farmerId,
      title: data.title,
      description: data.description ?? null,
      skillsRequired: data.skillsRequired,
      expectedDate: new Date(data.expectedDate),
      durationDays: data.durationDays,
      payAmountKobo: data.payAmountKobo,
      workersNeeded: data.workersNeeded,
      sourceForecastEventId: data.sourceForecastEventId ?? null,
      status: 'OPEN',
    },
  });

  // Fire-and-forget embedding + demand signals
  refreshJobEmbeddingAndDemandSignals(job.id, {
    title: job.title,
    description: job.description ?? undefined,
    skillsRequired: job.skillsRequired,
    farmerId: job.farmerId,
    durationDays: job.durationDays,
  }).catch(err => logger.warn('Job embedding/demand compute failed (non-fatal):', err));

  return job;
}

export async function getFarmerJobs(farmerId: string) {
  return prisma.job.findMany({
    where: { farmerId },
    include: {
      gigs: {
        include: {
          labourer: {
            select: { id: true, fullName: true, region: true, reputationTier: true, skills: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getJobById(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      farmer: {
        select: { id: true, name: true, region: true, cropType: true },
      },
      gigs: {
        include: {
          labourer: {
            select: { id: true, fullName: true, reputationTier: true },
          },
        },
      },
    },
  });
  if (!job) throw new AppError(404, 'Job not found');
  return job;
}

export async function updateJob(jobId: string, farmerId: string, data: {
  title?: string;
  description?: string;
  skillsRequired?: string[];
  expectedDate?: string;
  durationDays?: number;
  payAmountKobo?: bigint;
  workersNeeded?: number;
}) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError(404, 'Job not found');
  if (job.farmerId !== farmerId) throw new AppError(403, 'Not your job');
  if (job.status !== 'OPEN') throw new AppError(400, 'Can only update open jobs');

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.skillsRequired !== undefined && { skillsRequired: data.skillsRequired }),
      ...(data.expectedDate !== undefined && { expectedDate: new Date(data.expectedDate) }),
      ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
      ...(data.payAmountKobo !== undefined && { payAmountKobo: data.payAmountKobo }),
      ...(data.workersNeeded !== undefined && { workersNeeded: data.workersNeeded }),
    },
  });

  // Refresh embedding on update
  refreshJobEmbeddingAndDemandSignals(updated.id, {
    title: updated.title,
    description: updated.description ?? undefined,
    skillsRequired: updated.skillsRequired,
    farmerId: updated.farmerId,
    durationDays: updated.durationDays,
  }).catch(err => logger.warn('Job embedding refresh failed (non-fatal):', err));

  return updated;
}

export async function cancelJob(jobId: string, farmerId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError(404, 'Job not found');
  if (job.farmerId !== farmerId) throw new AppError(403, 'Not your job');
  if (job.status === 'CANCELLED') throw new AppError(400, 'Job already cancelled');

  // Cancel all accepted gigs
  await prisma.gig.updateMany({
    where: { jobId, status: 'ACCEPTED' },
    data: { status: 'CANCELLED', cancelReason: 'Job cancelled by farmer' },
  });

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  });

  return updated;
}

export async function acceptJob(jobId: string, labourerId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { gigs: true },
  });
  if (!job) throw new AppError(404, 'Job not found');
  if (job.status !== 'OPEN' && job.status !== 'FILLED') {
    throw new AppError(400, 'Job is not open for acceptance');
  }

  // Check idempotency — already accepted?
  const existing = await prisma.gig.findFirst({
    where: { jobId, labourerId },
  });
  if (existing) return existing;

  const gig = await prisma.gig.create({
    data: {
      jobId,
      labourerId,
      agreedAmountKobo: job.payAmountKobo,
      status: 'ACCEPTED',
    },
  });

  // Check if job is now filled
  const acceptedCount = await prisma.gig.count({
    where: { jobId, status: { not: 'CANCELLED' } },
  });
  if (acceptedCount >= job.workersNeeded) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FILLED' },
    });
    // Update MatchFeedback — labourer accepted
    await prisma.matchFeedback.updateMany({
      where: { jobId, labourerId, wasAccepted: false },
      data: { wasAccepted: true },
    });
  }

  // Update MatchFeedback
  const updated = await prisma.matchFeedback.updateMany({
    where: { jobId, labourerId },
    data: { wasAccepted: true },
  });
  if (updated.count === 0) {
    await prisma.matchFeedback.create({
      data: {
        jobId,
        labourerId,
        matchScore: 0,
        wasAccepted: true,
      },
    });
  }

  return gig;
}

// Embedding helper
export async function refreshJobEmbeddingAndDemandSignals(jobId: string, job: {
  title: string;
  description?: string;
  skillsRequired: string[];
  farmerId: string;
  durationDays: number;
}) {
  try {
    // Get the farmer's region for the embedding text
    const farmer = await prisma.farmer.findUnique({
      where: { id: job.farmerId },
      select: { region: true },
    });

    const [embRes, demandRes] = await Promise.all([
      aiClient.post('/embeddings/job', {
        title: job.title,
        description: job.description ?? '',
        skillsRequired: job.skillsRequired,
        region: farmer?.region ?? '',
        durationDays: job.durationDays,
      }),
      aiClient.get(`/demand-signals/${job.farmerId}`),
    ]);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        descriptionEmbedding: embRes.data.embedding,
        descriptionEmbeddingUpdatedAt: new Date(),
        demandConfidence: demandRes.data.confidence,
        demandConsistency: demandRes.data.consistency,
      },
    });
  } catch (err) {
    logger.warn(`Embedding/demand compute failed for job ${jobId}:`, err);
  }
}
