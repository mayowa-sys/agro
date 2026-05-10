import { useMemo } from 'react';
import { differenceInDays, format, parseISO, addDays, addMonths, startOfMonth } from 'date-fns';
import { TrendingUp, AlertTriangle, Hammer, Sprout } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import type { ForecastEvent, CashGap } from './ForecastCalendar';

interface Props {
  events: ForecastEvent[];
  cashGaps: CashGap[];
  horizonDays?: number;
}

const HORIZON = 180;
const STRIP_WIDTH = 100; // percentage

export function SeasonStrip({ events, cashGaps, horizonDays = HORIZON }: Props) {
  const today = useMemo(() => new Date(), []);
  const endDate = useMemo(() => addDays(today, horizonDays), [today, horizonDays]);

  const positionPct = (date: Date) => {
    const days = differenceInDays(date, today);
    return Math.max(0, Math.min(STRIP_WIDTH, (days / horizonDays) * STRIP_WIDTH));
  };

  // Build daily running balance series
  const { balanceSeries, minBalance, maxBalance } = useMemo(() => {
    const sorted = [...events].sort((a, b) =>
      parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );
    let running = 0;
    const series: { day: number; balance: number }[] = [];
    series.push({ day: 0, balance: 0 });
    for (const e of sorted) {
      const dayOffset = differenceInDays(parseISO(e.date), today);
      if (dayOffset < 0 || dayOffset > horizonDays) continue;
      running += e.type === 'INCOME' ? e.amount : -e.amount;
      series.push({ day: dayOffset, balance: running });
    }
    series.push({ day: horizonDays, balance: running });
    const balances = series.map(s => s.balance);
    return {
      balanceSeries: series,
      minBalance: Math.min(0, ...balances),
      maxBalance: Math.max(0, ...balances),
    };
  }, [events, today, horizonDays]);

  // Sparkline path
  const sparklinePath = useMemo(() => {
    const range = maxBalance - minBalance || 1;
    const yFor = (b: number) => 100 - ((b - minBalance) / range) * 100;
    const xFor = (d: number) => (d / horizonDays) * 100;
    if (balanceSeries.length === 0) return '';
    return balanceSeries
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.day).toFixed(2)} ${yFor(p.balance).toFixed(2)}`)
      .join(' ');
  }, [balanceSeries, minBalance, maxBalance, horizonDays]);

  const zeroLineY = useMemo(() => {
    const range = maxBalance - minBalance || 1;
    return 100 - ((0 - minBalance) / range) * 100;
  }, [minBalance, maxBalance]);

  // Categorize markers
  const inputMarkers = events
    .filter(e => e.category === 'INPUTS')
    .map(e => ({ date: parseISO(e.date), amount: e.amount }));

  const labourMarkers = events
    .filter(e => e.category === 'LABOUR')
    .map(e => ({ date: parseISO(e.date), amount: e.amount }));

  const incomeMarkers = events
    .filter(e => e.type === 'INCOME')
    .map(e => ({ date: parseISO(e.date), amount: e.amount }));

  // Month axis ticks (start of each month within horizon)
  const monthTicks = useMemo(() => {
    const ticks: { date: Date; label: string; pct: number }[] = [];
    let cursor = startOfMonth(today);
    while (cursor <= endDate) {
      const days = differenceInDays(cursor, today);
      if (days >= 0 && days <= horizonDays) {
        ticks.push({ date: cursor, label: format(cursor, 'MMM'), pct: (days / horizonDays) * 100 });
      }
      cursor = addMonths(cursor, 1);
    }
    return ticks;
  }, [today, endDate, horizonDays]);

  const worstGap = cashGaps.length > 0
    ? cashGaps.reduce((a, b) => (b.shortfallKobo > a.shortfallKobo ? b : a))
    : null;

  return (
    <div
      className="rounded-2xl px-6 pt-5 pb-4"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
    >
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Season at a glance
          </p>
          <p className="text-sm font-sans mt-1" style={{ color: 'hsl(var(--foreground))' }}>
            {format(today, 'MMM d')} – {format(endDate, 'MMM d, yyyy')}
            <span className="ml-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              · {horizonDays} days
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <span className="flex items-center gap-1.5"><Sprout size={10} className="text-leaf-500" /> Inputs</span>
          <span className="flex items-center gap-1.5"><Hammer size={10} /> Labour</span>
          <span className="flex items-center gap-1.5"><TrendingUp size={10} className="text-leaf-500" /> Harvest</span>
        </div>
      </div>

      {/* Three-lane strip */}
      <div className="space-y-1.5">

        {/* Lane 1 — Inputs and Labour markers */}
        <div className="relative h-5">
          {inputMarkers.map((m, i) => (
            <div
              key={`in-${i}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center"
              style={{ left: `${positionPct(m.date)}%` }}
              title={`${format(m.date, 'MMM d')} · Inputs · ${formatNaira(m.amount, { compact: true })}`}
            >
              <div
                className="rounded-full"
                style={{ width: 8, height: 8, background: 'hsl(var(--leaf-500, 142 70% 45%))' }}
              />
            </div>
          ))}
          {labourMarkers.map((m, i) => (
            <div
              key={`lab-${i}`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${positionPct(m.date)}%` }}
              title={`${format(m.date, 'MMM d')} · Labour · ${formatNaira(m.amount, { compact: true })}`}
            >
              <Hammer size={10} style={{ color: 'hsl(var(--muted-foreground))' }} />
            </div>
          ))}
        </div>

        {/* Lane 2 — Cash sparkline */}
        <div className="relative h-14">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0"
          >
            {/* Zero baseline */}
            <line
              x1="0" x2="100"
              y1={zeroLineY} y2={zeroLineY}
              stroke="hsl(var(--border))"
              strokeWidth="0.4"
              strokeDasharray="0.8 0.8"
              vectorEffect="non-scaling-stroke"
            />
            {/* Cash gap shaded region under zero */}
            {cashGaps.map((gap, i) => {
              const x1 = positionPct(parseISO(gap.startDate));
              const x2 = positionPct(parseISO(gap.endDate));
              return (
                <rect
                  key={`gap-rect-${i}`}
                  x={x1}
                  y={zeroLineY}
                  width={Math.max(0.3, x2 - x1)}
                  height={100 - zeroLineY}
                  fill="rgba(249,115,22,0.10)"
                />
              );
            })}
            {/* Sparkline */}
            <path
              d={sparklinePath}
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {/* Today marker (vertical line) */}
          <div className="absolute top-0 bottom-0 w-px" style={{ left: '0%', background: 'hsl(142 70% 45%)' }} />

          {/* Income tranche markers — gold dots overlaid on sparkline at zero crossing */}
          {incomeMarkers.map((m, i) => (
            <div
              key={`inc-${i}`}
              className="absolute -translate-x-1/2"
              style={{
                left: `${positionPct(m.date)}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              title={`${format(m.date, 'MMM d')} · Harvest · ${formatNaira(m.amount, { compact: true })}`}
            >
              <div
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background: 'hsl(var(--leaf-500, 142 70% 45%))',
                  boxShadow: '0 0 0 2px hsl(var(--card)), 0 0 0 3px hsl(var(--leaf-500, 142 70% 45%))',
                }}
              />
            </div>
          ))}

          {/* Worst-gap label */}
          {worstGap && (() => {
            const x1 = positionPct(parseISO(worstGap.startDate));
            const x2 = positionPct(parseISO(worstGap.endDate));
            const mid = (x1 + x2) / 2;
            return (
              <div
                className="absolute flex items-center gap-1 -translate-x-1/2 whitespace-nowrap pointer-events-none"
                style={{
                  left: `${mid}%`,
                  bottom: 4,
                  color: 'rgb(234 88 12)',
                }}
              >
                <AlertTriangle size={9} />
                <span className="text-[10px] font-semibold font-sans">
                  {formatNaira(worstGap.shortfallKobo, { compact: true })}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Lane 3 — Month axis */}
        <div className="relative h-5">
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'hsl(var(--border))' }} />
          {monthTicks.map((t, i) => (
            <div
              key={`mt-${i}`}
              className="absolute -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${t.pct}%`, top: 0 }}
            >
              <div className="w-px h-1.5" style={{ background: 'hsl(var(--border))' }} />
              <span className="text-[10px] font-sans mt-0.5 tabular-nums" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {t.label}
              </span>
            </div>
          ))}
          {/* Today label aligned with vertical line */}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: '0%', top: 0 }}
          >
            <div className="w-px h-1.5" style={{ background: 'hsl(142 70% 45%)' }} />
            <span className="text-[10px] font-sans font-semibold mt-0.5 uppercase tracking-wider" style={{ color: 'hsl(142 70% 45%)' }}>
              Today
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
