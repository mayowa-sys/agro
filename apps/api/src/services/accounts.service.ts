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
