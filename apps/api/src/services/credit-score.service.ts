import { prisma } from '../lib/prisma';

const TIER_LIMITS: Record<number, bigint> = {
  1: 20_000_00n,   // ₦20,000
  2: 50_000_00n,   // ₦50,000
  3: 80_000_00n,   // ₦80,000
  4: 150_000_00n,  // ₦150,000
  5: 200_000_00n,  // ₦200,000
};

function scoreToTier(score: number): number {
  if (score >= 800) return 5;
  if (score >= 700) return 4;
  if (score >= 600) return 3;
  if (score >= 500) return 2;
  return 1;
}

export async function recomputeCreditScore(farmerId: string) {
  const now = new Date();

  // ── 35%: Repayment history ──────────────────────────────────────────
  const credits = await prisma.inputDeferral.findMany({
    where: { farmerId, status: { in: ['REPAID', 'DEFAULTED'] } },
  });
  const totalCredits = credits.length;
  const repaidOnTime = credits.filter(c => {
    if (!c.expectedRepayBy || !c.repaidAt) return false;
    return c.repaidAt <= c.expectedRepayBy;
  }).length;
  const repaymentRatio = totalCredits === 0 ? 0.5 : repaidOnTime / totalCredits;
  const repaymentScore = Math.round(repaymentRatio * 100);

  // ── 25%: Forecast confidence (avg Prophet confidence) ───────────────
  const forecasts = await prisma.forecastEvent.findMany({
    where: { forecast: { farmerId } },
    select: { confidence: true },
    take: 100,
  });
  const avgConfidence = forecasts.length === 0
    ? 0.5
    : forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length;
  const confidenceScore = Math.round(avgConfidence * 100);

  // ── 15%: Gig posting reputation (avg labourer rating of farmer's gigs)
  const gigs = await prisma.gig.findMany({
    where: { job: { farmerId } },
    select: { rating: { select: { farmerScoreOfLabourer: true } } },
  });
  const ratings = gigs.flatMap(g => g.rating ? [g.rating.farmerScoreOfLabourer ?? 0] : []);
  const avgRating = ratings.length === 0 ? 3 : ratings.reduce((s, r) => s + r, 0) / ratings.length;
  const reputationScore = Math.round((avgRating / 5) * 100);

  // ── 15%: 30-day balance trend ───────────────────────────────────────
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentTxs = await prisma.transaction.findMany({
    where: {
      virtualAccount: { farmerId, purpose: 'WORKING' },
      occurredAt: { gte: thirtyDaysAgo },
    },
    orderBy: { occurredAt: 'asc' },
  });
  let balanceTrend = 0;
  if (recentTxs.length >= 5) {
    const firstHalf = recentTxs.slice(0, Math.floor(recentTxs.length / 2));
    const secondHalf = recentTxs.slice(Math.floor(recentTxs.length / 2));
    const firstAvg = firstHalf.reduce((s, t) => s + Number(t.amount), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, t) => s + Number(t.amount), 0) / secondHalf.length;
    balanceTrend = firstAvg === 0 ? 0 : (secondAvg - firstAvg) / firstAvg;
  }
  const trendScore = Math.round(Math.max(0, Math.min(1, 0.5 + balanceTrend)) * 100);

  // ── 10%: Account age ────────────────────────────────────────────────
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { createdAt: true },
  });
  const accountAgeMonths = farmer
    ? (now.getTime() - farmer.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 0;
  const ageScore = Math.min(100, Math.round((accountAgeMonths / 12) * 100));

  // ── Weighted total ──────────────────────────────────────────────────
  const score = Math.round(
    repaymentScore * 0.35 +
    confidenceScore * 0.25 +
    reputationScore * 0.15 +
    trendScore * 0.15 +
    ageScore * 0.10
  );
  const clamped = Math.min(850, Math.max(300, score));
  const tier = scoreToTier(clamped);
  const creditLimitKobo = TIER_LIMITS[tier];

  const components = {
    repaymentHistory: { weight: 0.35, score: repaymentScore },
    forecastConfidence: { weight: 0.25, score: confidenceScore },
    gigReputation: { weight: 0.15, score: reputationScore },
    balanceTrend: { weight: 0.15, score: trendScore },
    accountAge: { weight: 0.10, score: ageScore },
  };

  await prisma.creditScore.upsert({
    where: { farmerId },
    update: { score: clamped, tier, components, creditLimitKobo, computedAt: now },
    create: { farmerId, score: clamped, tier, components, creditLimitKobo, computedAt: now },
  });

  return { score: clamped, tier, components, creditLimitKobo };
}
