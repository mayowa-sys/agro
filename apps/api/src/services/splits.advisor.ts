/**
 * Forecast-driven split rule advisor.
 *
 * Given a farmer's current split rule, upcoming forecast events, current
 * pot balances, and active input credits, simulates a 90-day horizon under
 * the current rule and a constrained grid of candidate rules. Returns the
 * candidate (if any) that materially reduces shortfalls.
 *
 * Pure functions, no Prisma. Unit-testable in isolation.
 */

export type Pot = 'WORKING' | 'BILLS' | 'NEXT_SEASON';

export interface SplitPercentages {
  workingPct: number;
  billsPct: number;
  nextSeasonPct: number;
}

export interface ForecastEventLite {
  expectedDate: Date;
  expectedAmount: bigint;
  type: 'INCOME' | 'EXPENSE';
  category: string;
}

export interface PotBalances {
  working: bigint;
  bills: bigint;
  nextSeason: bigint;
}

export interface DeferralLite {
  amount: bigint;
  agroFee: bigint;
  expectedRepayBy: Date;
}

export interface AdvisorInput {
  current: SplitPercentages;
  events: ForecastEventLite[];
  balances: PotBalances;
  activeDeferrals: DeferralLite[];
  horizonDays?: number; // default 90
}

export interface PotSimulation {
  pot: Pot;
  startKobo: string;
  endKobo: string;
  inflowKobo: string;
  outflowKobo: string;
  minBalanceKobo: string;  // lowest point in the simulation
  shortfallKobo: string;   // total shortfall depth (kobo-days at negative)
}

export interface AdvisorOutput {
  current: SplitPercentages;
  recommended: SplitPercentages | null;
  status: 'OPTIMAL' | 'ADJUST' | 'CREDIT_NEEDED' | 'NO_DATA';
  explanation: string;
  drivingEvent: {
    expectedDate: string;
    category: string;
    amountKobo: string;
    pot: Pot;
  } | null;
  simulation: {
    currentRule: PotSimulation[];
    recommendedRule: PotSimulation[] | null;
    candidatesEvaluated: number;
    horizonDays: number;
  };
}

const CATEGORY_TO_POT: Record<string, Pot> = {
  HOUSEHOLD: 'BILLS',
  SCHOOL_FEES: 'BILLS',
  UTILITIES: 'BILLS',
  MEDICAL: 'BILLS',
  INPUTS: 'NEXT_SEASON',
  NEXT_SEASON: 'NEXT_SEASON',
  LABOUR: 'WORKING',
  TRANSPORT: 'WORKING',
};

function categoryToPot(category: string): Pot {
  return CATEGORY_TO_POT[category] ?? 'WORKING';
}

interface SimState {
  working: bigint;
  bills: bigint;
  nextSeason: bigint;
  workingMin: bigint;
  billsMin: bigint;
  nextSeasonMin: bigint;
  workingIn: bigint;
  workingOut: bigint;
  billsIn: bigint;
  billsOut: bigint;
  nextSeasonIn: bigint;
  nextSeasonOut: bigint;
  shortfallEvents: Array<{ date: Date; pot: Pot; depth: bigint; category: string; amount: bigint }>;
}

function simulate(
  rule: SplitPercentages,
  events: ForecastEventLite[],
  balances: PotBalances,
  deferrals: DeferralLite[],
  horizonDays: number,
): SimState {
  const state: SimState = {
    working: balances.working,
    bills: balances.bills,
    nextSeason: balances.nextSeason,
    workingMin: balances.working,
    billsMin: balances.bills,
    nextSeasonMin: balances.nextSeason,
    workingIn: 0n,
    workingOut: 0n,
    billsIn: 0n,
    billsOut: 0n,
    nextSeasonIn: 0n,
    nextSeasonOut: 0n,
    shortfallEvents: [],
  };

  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 86400000);
  const remainingDeferrals = deferrals.map(d => ({ ...d, repaid: false }));

  const sorted = [...events]
    .filter(e => e.expectedDate >= now && e.expectedDate <= horizonEnd)
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());

  for (const event of sorted) {
    if (event.type === 'INCOME') {
      let amount = event.expectedAmount;
      // Repay any deferrals due on or before this event
      for (const d of remainingDeferrals) {
        if (d.repaid) continue;
        if (d.expectedRepayBy.getTime() > event.expectedDate.getTime()) continue;
        const due = d.amount + d.agroFee;
        if (amount >= due) {
          amount -= due;
          d.repaid = true;
        }
      }
      // Split the post-repayment remainder
      const wShare = (amount * BigInt(rule.workingPct)) / 100n;
      const bShare = (amount * BigInt(rule.billsPct)) / 100n;
      const nShare = amount - wShare - bShare;
      state.working += wShare;
      state.bills += bShare;
      state.nextSeason += nShare;
      state.workingIn += wShare;
      state.billsIn += bShare;
      state.nextSeasonIn += nShare;
    } else {
      const pot = categoryToPot(event.category);
      const amt = event.expectedAmount;
      if (pot === 'WORKING') {
        state.working -= amt;
        state.workingOut += amt;
        if (state.working < state.workingMin) state.workingMin = state.working;
        if (state.working < 0n) {
          state.shortfallEvents.push({ date: event.expectedDate, pot, depth: -state.working, category: event.category, amount: amt });
        }
      } else if (pot === 'BILLS') {
        state.bills -= amt;
        state.billsOut += amt;
        if (state.bills < state.billsMin) state.billsMin = state.bills;
        if (state.bills < 0n) {
          state.shortfallEvents.push({ date: event.expectedDate, pot, depth: -state.bills, category: event.category, amount: amt });
        }
      } else {
        state.nextSeason -= amt;
        state.nextSeasonOut += amt;
        if (state.nextSeason < state.nextSeasonMin) state.nextSeasonMin = state.nextSeason;
        if (state.nextSeason < 0n) {
          state.shortfallEvents.push({ date: event.expectedDate, pot, depth: -state.nextSeason, category: event.category, amount: amt });
        }
      }
    }
  }

  return state;
}

function score(state: SimState): bigint {
  // Score = total shortfall kobo + 1000kobo penalty per shortfall event count
  let total = 0n;
  for (const sf of state.shortfallEvents) total += sf.depth;
  return total + BigInt(state.shortfallEvents.length) * 100000n;
}

function toSimSummary(state: SimState, balances: PotBalances): PotSimulation[] {
  // Total shortfall depth per pot
  let wSF = 0n, bSF = 0n, nSF = 0n;
  for (const sf of state.shortfallEvents) {
    if (sf.pot === 'WORKING') wSF += sf.depth;
    else if (sf.pot === 'BILLS') bSF += sf.depth;
    else nSF += sf.depth;
  }
  return [
    { pot: 'WORKING', startKobo: String(balances.working), endKobo: String(state.working), inflowKobo: String(state.workingIn), outflowKobo: String(state.workingOut), minBalanceKobo: String(state.workingMin), shortfallKobo: String(wSF) },
    { pot: 'BILLS', startKobo: String(balances.bills), endKobo: String(state.bills), inflowKobo: String(state.billsIn), outflowKobo: String(state.billsOut), minBalanceKobo: String(state.billsMin), shortfallKobo: String(bSF) },
    { pot: 'NEXT_SEASON', startKobo: String(balances.nextSeason), endKobo: String(state.nextSeason), inflowKobo: String(state.nextSeasonIn), outflowKobo: String(state.nextSeasonOut), minBalanceKobo: String(state.nextSeasonMin), shortfallKobo: String(nSF) },
  ];
}

function formatNaira(kobo: bigint): string {
  const n = Number(kobo) / 100;
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

export function adviseSplit(input: AdvisorInput): AdvisorOutput {
  const horizonDays = input.horizonDays ?? 120;
  const { current, events, balances, activeDeferrals } = input;

  // No upcoming events at all
  if (events.length === 0) {
    return {
      current,
      recommended: null,
      status: 'NO_DATA',
      explanation: 'No upcoming forecast events. Recommendation unavailable until your forecast is generated.',
      drivingEvent: null,
      simulation: { currentRule: [], recommendedRule: null, candidatesEvaluated: 0, horizonDays },
    };
  }

  // Build candidate grid. workingPct floor 40, each pct in [5, 90], movement cap 15pp from current.
  const candidates: SplitPercentages[] = [];
  for (let b = 10; b <= 50; b += 5) {
    for (let n = 10; n <= 40; n += 5) {
      const w = 100 - b - n;
      if (w < 40) continue;
      if (Math.abs(b - current.billsPct) > 15) continue;
      if (Math.abs(n - current.nextSeasonPct) > 15) continue;
      candidates.push({ workingPct: w, billsPct: b, nextSeasonPct: n });
    }
  }
  // Always include current
  if (!candidates.some(c => c.workingPct === current.workingPct && c.billsPct === current.billsPct && c.nextSeasonPct === current.nextSeasonPct)) {
    candidates.push({ ...current });
  }

  const currentSim = simulate(current, events, balances, activeDeferrals, horizonDays);
  const currentScore = score(currentSim);

  let bestCandidate = current;
  let bestSim = currentSim;
  let bestScore = currentScore;

  for (const c of candidates) {
    if (c.workingPct === current.workingPct && c.billsPct === current.billsPct && c.nextSeasonPct === current.nextSeasonPct) continue;
    const sim = simulate(c, events, balances, activeDeferrals, horizonDays);
    const s = score(sim);
    if (s < bestScore) {
      bestScore = s;
      bestCandidate = c;
      bestSim = sim;
    }
  }

  const currentSimSummary = toSimSummary(currentSim, balances);

  // Case A: current rule has zero shortfalls — optimal
  if (currentScore === 0n) {
    return {
      current,
      recommended: null,
      status: 'OPTIMAL',
      explanation: `Your forecast over the next ${horizonDays} days: ${formatNaira(currentSim.billsOut)} household + ${formatNaira(currentSim.nextSeasonOut)} inputs vs ${formatNaira(currentSim.billsIn + currentSim.nextSeasonIn + currentSim.workingIn)} projected harvest income. Your ${current.billsPct}% Bills allocation comfortably covers what's coming. No adjustment needed.`,
      drivingEvent: null,
      simulation: { currentRule: currentSimSummary, recommendedRule: null, candidatesEvaluated: candidates.length, horizonDays },
    };
  }

  // Case B: best candidate fixes the shortfall (≥80% reduction)
  if (bestScore * 5n < currentScore) {
    // Find the worst shortfall under current rule to use as driving event
    const worst = currentSim.shortfallEvents.reduce((a, b) => a.depth > b.depth ? a : b);
    const recommendedSimSummary = toSimSummary(bestSim, balances);

    // Identify which pot is changing the most
    const dBills = bestCandidate.billsPct - current.billsPct;
    const dNext = bestCandidate.nextSeasonPct - current.nextSeasonPct;
    const dWorking = bestCandidate.workingPct - current.workingPct;
    let changeDesc = '';
    if (Math.abs(dBills) >= Math.abs(dNext) && Math.abs(dBills) >= Math.abs(dWorking)) {
      changeDesc = `Bills from ${current.billsPct}% to ${bestCandidate.billsPct}%`;
    } else if (Math.abs(dNext) >= Math.abs(dWorking)) {
      changeDesc = `Next Season from ${current.nextSeasonPct}% to ${bestCandidate.nextSeasonPct}%`;
    } else {
      changeDesc = `Working from ${current.workingPct}% to ${bestCandidate.workingPct}%`;
    }

    return {
      current,
      recommended: bestCandidate,
      status: 'ADJUST',
      explanation: `Your forecast shows ${formatNaira(worst.amount)} ${worst.category.toLowerCase().replace('_', ' ')} on ${formatDate(worst.date)}. Your current ${current.billsPct}/${current.nextSeasonPct}/${current.workingPct} split would overdraw ${worst.pot.toLowerCase().replace('_', ' ')} by ${formatNaira(worst.depth)}. Adjusting ${changeDesc} eliminates the shortfall.`,
      drivingEvent: {
        expectedDate: worst.date.toISOString(),
        category: worst.category,
        amountKobo: String(worst.amount),
        pot: worst.pot,
      },
      simulation: { currentRule: currentSimSummary, recommendedRule: recommendedSimSummary, candidatesEvaluated: candidates.length, horizonDays },
    };
  }

  // Case C: shortfall exists but no split can fix it (timing problem).
  // Input credit helps when the pre-harvest expense is procurable from a
  // supplier (INPUTS, LABOUR). For HOUSEHOLD-driven shortfalls, AGRO's input
  // credit indirectly helps by covering input expenses and freeing the
  // farmer's cash for household needs.
  const sorted = [...events].filter(e => e.expectedDate >= new Date()).sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
  const nextHarvest = sorted.find(e => e.type === 'INCOME');

  // Prefer an INPUTS or LABOUR shortfall as the driving event if one exists;
  // these are the ones input credit can directly bridge.
  const procurableShortfall = currentSim.shortfallEvents.find(
    sf => sf.category === 'INPUTS' || sf.category === 'LABOUR'
  );
  const worstShortfall = currentSim.shortfallEvents.reduce((a, b) => a.depth > b.depth ? a : b);
  const driving = procurableShortfall ?? worstShortfall;

  const hasTimingProblem = nextHarvest && nextHarvest.expectedDate > driving.date;

  if (hasTimingProblem) {
    const isProcurable = driving.category === 'INPUTS' || driving.category === 'LABOUR';
    const explanation = isProcurable
      ? `Your ${formatNaira(driving.amount)} ${driving.category.toLowerCase()} expense on ${formatDate(driving.date)} arrives before your next harvest on ${formatDate(nextHarvest!.expectedDate)}. This is exactly what input credit is for — AGRO pays the supplier directly, you repay from harvest.`
      : `Your ${formatNaira(driving.amount)} ${driving.category.toLowerCase().replace('_', ' ')} expense on ${formatDate(driving.date)} arrives before your next harvest on ${formatDate(nextHarvest!.expectedDate)}. Split rules can't bridge timing. AGRO input credit covers your input costs (fertilizer, seed, labour), freeing your cash buffer for non-procurable expenses like this one.`;

    return {
      current,
      recommended: null,
      status: 'CREDIT_NEEDED',
      explanation,
      drivingEvent: {
        expectedDate: driving.date.toISOString(),
        category: driving.category,
        amountKobo: String(driving.amount),
        pot: driving.pot,
      },
      simulation: { currentRule: currentSimSummary, recommendedRule: null, candidatesEvaluated: candidates.length, horizonDays },
    };
  }

  // Case D: small shortfall, best candidate isn't materially better
  return {
    current,
    recommended: null,
    status: 'OPTIMAL',
    explanation: `Your current split has a minor projected shortfall (${formatNaira(currentScore)}) but no candidate rule meaningfully improves on it. Holding the current allocation.`,
    drivingEvent: null,
    simulation: { currentRule: currentSimSummary, recommendedRule: null, candidatesEvaluated: candidates.length, horizonDays },
  };
}
