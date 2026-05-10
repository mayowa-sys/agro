import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { createLabourSavingsAccountForUser } from './accounts.service';
import { aiClient } from '../lib/ai-client';
import logger from '../lib/logger';

export async function createLabourer(userId: string, data: {
  fullName: string;
  region: string;
  state: string;
  latitude?: number;
  longitude?: number;
  skills: string[];
  spokenLanguages: string[];
}) {
  // Check user exists and has LABOURER role
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (user.role !== 'LABOURER') throw new AppError(403, 'User is not a labourer');

  // Check labourer profile doesn't already exist
  const existing = await prisma.labourer.findUnique({ where: { userId } });
  if (existing) throw new AppError(409, 'Labourer profile already exists');

  const labourer = await prisma.labourer.create({
    data: {
      userId,
      fullName: data.fullName,
      region: data.region,
      state: data.state,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      skills: data.skills,
      spokenLanguages: data.spokenLanguages,
    },
  });

  // Create labour savings VA
  const savingsAccount = await createLabourSavingsAccountForUser(userId);

  // Fire-and-forget embedding computation
  refreshLabourerEmbedding(labourer.id, {
    fullName: labourer.fullName,
    region: labourer.region,
    skills: labourer.skills,
    spokenLanguages: labourer.spokenLanguages,
  }).catch(err => logger.warn('Embedding compute failed (non-fatal):', err));

  return { labourer, savingsAccount };
}

export async function getLabourerByUserId(userId: string) {
  const labourer = await prisma.labourer.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, phone: true, role: true } },
    },
  });
  if (!labourer) throw new AppError(404, 'Labourer profile not found');
  return labourer;
}

export async function updateLabourer(userId: string, data: {
  fullName?: string;
  region?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  skills?: string[];
  spokenLanguages?: string[];
  language?: string;   // <-- ADD THIS
}) {
  const labourer = await prisma.labourer.findUnique({ where: { userId } });
  if (!labourer) throw new AppError(404, 'Labourer profile not found');

  const updated = await prisma.labourer.update({
    where: { userId },
    data: {
      ...(data.fullName !== undefined && { fullName: data.fullName }),
      ...(data.region !== undefined && { region: data.region }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.skills !== undefined && { skills: data.skills }),
      ...(data.spokenLanguages !== undefined && { spokenLanguages: data.spokenLanguages }),
    },
  });

  // Refresh embedding on update
  refreshLabourerEmbedding(updated.id, {
    fullName: updated.fullName,
    region: updated.region,
    skills: updated.skills,
    spokenLanguages: updated.spokenLanguages,
  }).catch(err => logger.warn('Embedding refresh failed (non-fatal):', err));

  // If language is provided, update the User record
  if (data.language) {
    await prisma.user.update({
      where: { id: userId },
      data: { language: data.language as any },
    });
  }

  return updated;
}

export async function getLabourerDashboard(userId: string) {
  const labourer = await prisma.labourer.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, phone: true } },
    },
  });
  if (!labourer) throw new AppError(404, 'Labourer profile not found');

  // Get savings account
  const savingsAccount = await prisma.virtualAccount.findFirst({
    where: { userId, purpose: 'LABOUR_SAVINGS' },
  });
  if (!savingsAccount) throw new AppError(404, 'Savings account not found');

  // Upcoming gigs
  const upcomingGigs = await prisma.gig.findMany({
    where: {
      labourerId: labourer.id,
      status: { in: ['ACCEPTED', 'FARMER_CONFIRMED_DONE', 'LABOURER_CONFIRMED_DONE'] },
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          expectedDate: true,
          payAmountKobo: true,
          durationDays: true,
          skillsRequired: true,
          farmer: {
            select: {
              id: true,
              user: { select: { phone: true } },
            },
          },
        },
      },
    },
    orderBy: { acceptedAt: 'desc' },
    take: 10,
  });

  // Completed gigs count
  const completedGigsCount = await prisma.gig.count({
    where: {
      labourerId: labourer.id,
      status: { in: ['PAID', 'CLOSED'] },
    },
  });

  // Nearby jobs — delegate to AI match service if available
  let nearbyJobs: any[] = [];
  try {
    const res = await aiClient.get(`/match/jobs-for-labourer/${labourer.id}`, { params: { limit: 10 } });
    nearbyJobs = res.data?.matches ?? [];
  } catch (err) {
    logger.warn('AI match service unavailable for dashboard, returning empty nearbyJobs:', err);
  }

  // Recent transactions from wage transfers
  const recentWageTransfers = await prisma.wageTransfer.findMany({
    where: {
      toVirtualAccountId: savingsAccount.id,
      status: 'SUCCEEDED',
    },
    orderBy: { succeededAt: 'desc' },
    take: 5,
  });

  return {
    labourer: {
      name: labourer.fullName,
      region: labourer.region,
      skills: labourer.skills,
      reputationTier: labourer.reputationTier,
      totalGigsCompleted: labourer.totalGigsCompleted,
    },
    savingsAccount: {
      id: savingsAccount.id,
      balanceKobo: savingsAccount.cachedBalance.toString(),
      squadAccountNumber: savingsAccount.squadAccountNumber,
    },
    upcomingGigs,
    completedGigsCount,
    totalEarnedKobo: labourer.totalEarnedKobo.toString(),
    nearbyJobs,
    recentTransactions: recentWageTransfers,
  };
}

export async function getReputation(userId: string) {
  const labourer = await prisma.labourer.findUnique({
    where: { userId },
    include: {
      ratingsReceived: {
        where: { farmerScoreOfLabourer: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!labourer) throw new AppError(404, 'Labourer profile not found');

  const scores = labourer.ratingsReceived
    .map(r => r.farmerScoreOfLabourer)
    .filter((s): s is number => s !== null);

  const avgRating = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  return {
    tier: labourer.reputationTier,
    totalGigsCompleted: labourer.totalGigsCompleted,
    totalRatingsReceived: scores.length,
    averageRating: avgRating ? Math.round(avgRating * 100) / 100 : null,
    recentRatings: labourer.ratingsReceived.map(r => ({
      gigId: r.gigId,
      score: r.farmerScoreOfLabourer,
      comment: r.farmerComment,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function recomputeReputationTier(labourerId: string) {
  const ratings = await prisma.rating.findMany({
    where: {
      labourerId,
      farmerScoreOfLabourer: { not: null },
    },
    select: { farmerScoreOfLabourer: true },
  });

  const gigCount = await prisma.gig.count({
    where: {
      labourerId,
      status: { in: ['PAID', 'CLOSED'] },
    },
  });

  const scores = ratings
    .map(r => r.farmerScoreOfLabourer)
    .filter((s): s is number => s !== null);

  const avgRating = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  let tier = 1;
  if (gigCount >= 200 && avgRating >= 4.5) tier = 5;
  else if (gigCount >= 50 && avgRating >= 4.3) tier = 4;
  else if (gigCount >= 15 && avgRating >= 4.0) tier = 3;
  else if (gigCount >= 5 && avgRating >= 3.5) tier = 2;

  await prisma.labourer.update({
    where: { id: labourerId },
    data: { reputationTier: tier },
  });

  return { tier, gigCount, avgRating: Math.round(avgRating * 100) / 100 };
}

export async function refreshLabourerEmbedding(labourerId: string, labourerData: {
  fullName: string;
  region: string;
  skills: string[];
  spokenLanguages: string[];
}) {
  try {
    const res = await aiClient.post('/embeddings/labourer', labourerData);
    await prisma.labourer.update({
      where: { id: labourerId },
      data: {
        profileEmbedding: res.data.embedding,
        profileEmbeddingUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn(`Embedding compute failed for labourer ${labourerId}:`, err);
  }
}
