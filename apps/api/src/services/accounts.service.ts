import { prisma } from '../lib/prisma';
import { squadClient } from '../squad/squad.client';
import { AccountPurpose } from '@prisma/client';

export async function createThreeAccountsForFarmer(farmerId: string) {
  const farmer = await prisma.farmer.findUniqueOrThrow({
    where: { id: farmerId },
    include: { user: true },
  });

  const purposes: AccountPurpose[] = ['WORKING', 'BILLS', 'NEXT_SEASON'];
  const accounts = [];

  for (const purpose of purposes) {
    // Skip if already exists
    const existing = await prisma.virtualAccount.findFirst({
      where: { farmerId, purpose },
    });
    if (existing) {
      accounts.push(existing);
      continue;
    }

    const nameParts = farmer.name.split(' ');
    const squadVA = await squadClient.createVirtualAccount({
      customer_identifier: `${farmerId}-${purpose}`,
      first_name: nameParts[0],
      last_name: nameParts[1] ?? nameParts[0],
      mobile_num: farmer.user.phone,
      dob: '1990-01-01',
      bvn: farmer.hashedBvn ?? undefined,
    });

    const va = await prisma.virtualAccount.create({
      data: {
        farmerId,
        squadAccountNumber: squadVA.account_number,
        squadCustomerId: squadVA.customer_id,
        bankName: squadVA.bank ?? 'GTBank',
        purpose,
      },
    });
    accounts.push(va);
  }

  return accounts;
}

export async function getFarmerAccounts(farmerId: string) {
  return prisma.virtualAccount.findMany({
    where: { farmerId },
    orderBy: { purpose: 'asc' },
  });
}

export async function getAccountTransactions(
  virtualAccountId: string,
  farmerId: string,
  page: number = 1,
  pageSize: number = 20
) {
  // Confirm ownership
  const va = await prisma.virtualAccount.findFirstOrThrow({
    where: { id: virtualAccountId, farmerId },
  });

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { virtualAccountId: va.id },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where: { virtualAccountId: va.id } }),
  ]);

  return { transactions, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function refreshAccountBalance(virtualAccountId: string, farmerId: string) {
  const va = await prisma.virtualAccount.findFirstOrThrow({
    where: { id: virtualAccountId, farmerId },
  });

  const squadData = await squadClient.getVirtualAccount(va.squadCustomerId);
  const balanceKobo = BigInt(Math.round((squadData.balance ?? 0) * 100));

  const updated = await prisma.virtualAccount.update({
    where: { id: va.id },
    data: { cachedBalance: balanceKobo },
  });

  return updated;
}

export async function createLabourSavingsAccountForUser(userId: string) {
  // Check if LABOUR_SAVINGS VA already exists for this user
  const existing = await prisma.virtualAccount.findFirst({
    where: { userId, purpose: 'LABOUR_SAVINGS' },
  });
  if (existing) return existing;

  // Get the labourer profile for names
  const labourer = await prisma.labourer.findUniqueOrThrow({
    where: { userId },
    include: { user: true },
  });

  const nameParts = labourer.fullName.split(' ');
  const squadVA = await squadClient.createVirtualAccount({
    customer_identifier: `${userId}-labour-savings`,
    first_name: nameParts[0],
    last_name: nameParts[1] ?? nameParts[0],
    mobile_num: labourer.user.phone,
    dob: '1990-01-01',
  });

  const va = await prisma.virtualAccount.create({
    data: {
      userId,
      squadAccountNumber: squadVA.account_number,
      squadCustomerId: squadVA.customer_id,
      bankName: squadVA.bank ?? 'GTBank',
      purpose: 'LABOUR_SAVINGS',
    },
  });

  return va;
}

export async function getFarmerDashboard(userId: string) {
  const { prisma } = await import('../lib/prisma');

  const farmer = await prisma.farmer.findUnique({
    where: { userId },
    include: { user: { select: { id: true, phone: true } } },
  });
  if (!farmer) throw new Error('Farmer profile not found');

  // Virtual accounts
  const accounts = await prisma.virtualAccount.findMany({
    where: { farmerId: farmer.id },
    orderBy: { purpose: 'asc' },
  });

  // Active deferrals
  const activeDeferrals = await prisma.inputDeferral.findMany({
    where: { farmerId: farmer.id, status: { in: ['PENDING', 'ACTIVE'] } },
    include: { supplier: { select: { name: true } } },
    orderBy: { expectedRepayBy: 'asc' },
    take: 5,
  });

  // Jobs summary
  const [openJobsCount, filledJobsCount] = await Promise.all([
    prisma.job.count({ where: { farmerId: farmer.id, status: 'OPEN' } }),
    prisma.job.count({ where: { farmerId: farmer.id, status: 'FILLED' } }),
  ]);

  // Active gigs needing farmer action
  const activeGigs = await prisma.gig.findMany({
    where: {
      job: { farmerId: farmer.id },
      status: { in: ['ACCEPTED', 'LABOURER_CONFIRMED_DONE'] },
    },
    include: {
      labourer: { select: { fullName: true, reputationTier: true, region: true } },
      job: { select: { title: true, expectedDate: true, payAmountKobo: true } },
    },
    orderBy: { acceptedAt: 'desc' },
    take: 5,
  });

  // Liberation totals
  const now = new Date();
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [monthLogs, allLogs] = await Promise.all([
    prisma.liberationLog.findMany({ where: { loggedAt: { gte: monthStart } } }),
    prisma.liberationLog.findMany(),
  ]);

  function sumLogs(logs: any[]) {
    let total = BigInt(0);
    let byMiddlemanDiscount = BigInt(0);
    let byCashOnDayPremium = BigInt(0);
    for (const log of logs) {
      total += BigInt(log.counterfactualLossKobo);
      if (log.source === 'MIDDLEMAN_DISCOUNT_AVOIDED') byMiddlemanDiscount += BigInt(log.counterfactualLossKobo);
      if (log.source === 'CASH_ON_DAY_PREMIUM_CAPTURED') byCashOnDayPremium += BigInt(log.counterfactualLossKobo);
    }
    return {
      total: String(total),
      byMiddlemanDiscount: String(byMiddlemanDiscount),
      byCashOnDayPremium: String(byCashOnDayPremium),
    };
  }

  // Next forecast cash gap
  const upcomingGap = await prisma.forecastEvent.findFirst({
    where: {
      forecast: { farmerId: farmer.id },
      expectedDate: { gte: now },
      expectedAmount: { lt: 0 },
    },
    orderBy: { expectedDate: 'asc' },
  });

  return {
    farmer: {
      name: farmer.name,
      region: farmer.region,
      cropType: farmer.cropType,
      phone: farmer.user.phone,
    },
    accounts: accounts.map(a => ({
      id: a.id,
      purpose: a.purpose,
      balanceKobo: String(a.cachedBalance),
      squadAccountNumber: a.squadAccountNumber,
    })),
    activeDeferrals: activeDeferrals.map(d => ({
      id: d.id,
      supplierName: d.supplier.name,
      amountKobo: String(d.amount),
      repaymentDate: d.expectedRepayBy,
      status: d.status,
    })),
    jobs: { open: openJobsCount, filled: filledJobsCount },
    activeGigs: activeGigs.map(g => ({
      id: g.id,
      status: g.status,
      jobTitle: g.job.title,
      expectedDate: g.job.expectedDate,
      amountKobo: String(g.job.payAmountKobo),
      labourer: {
        name: g.labourer.fullName,
        tier: g.labourer.reputationTier,
        region: g.labourer.region,
      },
    })),
    liberation: {
      month: sumLogs(monthLogs),
      allTime: sumLogs(allLogs),
    },
    nextCashGap: upcomingGap ? {
      date: upcomingGap.expectedDate,
      amountKobo: String(upcomingGap.expectedAmount),
    } : null,
  };
}
