import { useMemo } from 'react';
import { format, parseISO, addMonths, startOfMonth, differenceInDays } from 'date-fns';
import { TrendingUp, TrendingDown, AlertTriangle, Sprout, Hammer } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import type { ForecastEvent, CashGap } from './ForecastCalendar';

interface BalancePoint {
  day: number;
  date: string;
  balanceKobo: string;
}

interface Props {
  series: BalancePoint[];
  events: ForecastEvent[];
  cashGaps: CashGap[];
  horizonDays: number;
}

const PADDING = { top: 28, right: 16, bottom: 36, left: 56 };
const HEIGHT = 280;

export function SeasonChart({ series, events, cashGaps, horizonDays }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  const points = useMemo(() => series.map(p => ({
    day: p.day,
    date: parseISO(p.date),
    balance: Number(p.balanceKobo),
  })), [series]);

  const { minBal, maxBal } = useMemo(() => {
    if (points.length === 0) return { minBal: 0, maxBal: 1 };
    const vals = points.map(p => p.balance);
    let min = Math.min(0, ...vals);
    let max = Math.max(0, ...vals);
    const span = max - min || 1;
    min -= span * 0.08;
    max += span * 0.08;
    return { minBal: min, maxBal: max };
  }, [points]);

  const xScale = (day: number, width: number) =>
    PADDING.left + (day / horizonDays) * (width - PADDING.left - PADDING.right);

  const yScale = (balance: number, height: number) => {
    const range = maxBal - minBal || 1;
    return PADDING.top + (1 - (balance - minBal) / range) * (height - PADDING.top - PADDING.bottom);
  };

  const monthTicks = useMemo(() => {
    const ticks: { date: Date; label: string; day: number }[] = [];
    let cursor = startOfMonth(today);
    const end = new Date(today.getTime() + horizonDays * 86400000);
    while (cursor <= end) {
      const day = differenceInDays(cursor, today);
      if (day >= 0 && day <= horizonDays) {
        ticks.push({ date: cursor, label: format(cursor, 'MMM'), day });
      }
      cursor = addMonths(cursor, 1);
    }
    return ticks;
  }, [today, horizonDays]);

  const yTicks = useMemo(() => {
    const range = maxBal - minBal;
    const step = range / 4;
    return [0, 1, 2, 3, 4].map(i => minBal + step * i);
  }, [minBal, maxBal]);

  const chartWidth = 1000;
  const innerW = chartWidth - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;
  const zeroY = yScale(0, HEIGHT);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.day, chartWidth).toFixed(2)} ${yScale(p.balance, HEIGHT).toFixed(2)}`)
      .join(' ');
  }, [points, minBal, maxBal, horizonDays]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.day, chartWidth).toFixed(2)} ${yScale(p.balance, HEIGHT).toFixed(2)}`).join(' ');
    const close = `L ${xScale(points[points.length - 1].day, chartWidth).toFixed(2)} ${zeroY.toFixed(2)} L ${xScale(points[0].day, chartWidth).toFixed(2)} ${zeroY.toFixed(2)} Z`;
    return top + ' ' + close;
  }, [points, minBal, maxBal, horizonDays, zeroY]);

  // Marker events
  const incomeMarkers = events.filter(e => e.type === 'INCOME').map(e => ({
    date: parseISO(e.date),
    amount: e.amount,
    reasons: e.reasons,
    day: differenceInDays(parseISO(e.date), today),
  })).filter(m => m.day >= 0 && m.day <= horizonDays);

  const inputMarkers = events.filter(e => e.category === 'INPUTS').map(e => ({
    date: parseISO(e.date),
    amount: e.amount,
    day: differenceInDays(parseISO(e.date), today),
  })).filter(m => m.day >= 0 && m.day <= horizonDays);

  const labourMarkers = events.filter(e => e.category === 'LABOUR').map(e => ({
    date: parseISO(e.date),
    amount: e.amount,
    day: differenceInDays(parseISO(e.date), today),
  })).filter(m => m.day >= 0 && m.day <= horizonDays);

  const finalBalance = points[points.length - 1]?.balance ?? 0;
  const isPositiveOutlook = finalBalance >= 0;

  return (
    <div className="rounded-2xl px-6 pt-5 pb-3" style={{
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
    }}>
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Projected balance
          </p>
          <p className="text-sm font-sans mt-1" style={{ color: 'hsl(var(--foreground))' }}>
            {format(today, 'MMM d')} – {format(new Date(today.getTime() + horizonDays * 86400000), 'MMM d, yyyy')}
            <span className="ml-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>· {horizonDays} days</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <span className="flex items-center gap-1.5"><Sprout size={10} className="text-leaf-500" /> Inputs</span>
          <span className="flex items-center gap-1.5"><Hammer size={10} /> Labour</span>
          <span className="flex items-center gap-1.5"><TrendingUp size={10} className="text-leaf-500" /> Harvest</span>
        </div>
      </div>

      {/* Outlook summary */}
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-display text-3xl tabular-nums" style={{ color: isPositiveOutlook ? 'hsl(142 70% 45%)' : 'rgb(234 88 12)' }}>
          {finalBalance >= 0 ? '+' : '−'}{formatNaira(Math.abs(finalBalance), { compact: true })}
        </span>
        <span className="text-xs font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
          end-of-season balance
        </span>
        {isPositiveOutlook ? (
          <TrendingUp size={14} className="text-leaf-500" />
        ) : (
          <TrendingDown size={14} className="text-orange-500" />
        )}
      </div>

      {/* Chart */}
      <div className="relative w-full" style={{ aspectRatio: `${chartWidth} / ${HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="positiveArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142 70% 45%)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(142 70% 45%)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="negativeArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(249,115,22)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="rgb(249,115,22)" stopOpacity="0.20" />
            </linearGradient>
            <clipPath id="aboveZero">
              <rect x="0" y="0" width={chartWidth} height={zeroY} />
            </clipPath>
            <clipPath id="belowZero">
              <rect x="0" y={zeroY} width={chartWidth} height={HEIGHT - zeroY} />
            </clipPath>
          </defs>

          {/* Y-axis grid lines and labels */}
          {yTicks.map((tick, i) => {
            const y = yScale(tick, HEIGHT);
            const isZero = Math.abs(tick) < 1;
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={PADDING.left} x2={chartWidth - PADDING.right}
                  y1={y} y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth={isZero ? '1' : '0.5'}
                  strokeDasharray={isZero ? '0' : '3 3'}
                  opacity={isZero ? 0.6 : 0.35}
                />
                <text
                  x={PADDING.left - 8} y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="hsl(var(--muted-foreground))"
                  fontFamily="DM Sans, sans-serif"
                  className="tabular-nums"
                >
                  {formatNaira(tick, { compact: true })}
                </text>
              </g>
            );
          })}

          {/* Cash gap shading underneath line */}
          {cashGaps.map((gap, i) => {
            const startDay = differenceInDays(parseISO(gap.startDate), today);
            const endDay = differenceInDays(parseISO(gap.endDate), today);
            const x1 = xScale(Math.max(0, startDay), chartWidth);
            const x2 = xScale(Math.min(horizonDays, endDay), chartWidth);
            return (
              <rect
                key={`gap-${i}`}
                x={x1} y={zeroY}
                width={Math.max(1, x2 - x1)}
                height={HEIGHT - PADDING.bottom - zeroY}
                fill="rgb(249,115,22)"
                opacity="0.06"
              />
            );
          })}

          {/* Area fills — positive above zero, negative below zero */}
          <path d={areaPath} fill="url(#positiveArea)" clipPath="url(#aboveZero)" />
          <path d={areaPath} fill="url(#negativeArea)" clipPath="url(#belowZero)" />

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Today vertical marker */}
          <line
            x1={xScale(0, chartWidth)} x2={xScale(0, chartWidth)}
            y1={PADDING.top} y2={HEIGHT - PADDING.bottom}
            stroke="hsl(142 70% 45%)"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.7"
          />
          <text
            x={xScale(0, chartWidth) + 4}
            y={PADDING.top + 10}
            fontSize="9"
            fill="hsl(142 70% 45%)"
            fontFamily="DM Sans, sans-serif"
            fontWeight="600"
            className="uppercase"
            letterSpacing="0.1em"
          >
            Today
          </text>

          {/* Month axis ticks */}
          {monthTicks.map((tick, i) => {
            const x = xScale(tick.day, chartWidth);
            return (
              <g key={`mt-${i}`}>
                <line
                  x1={x} x2={x}
                  y1={HEIGHT - PADDING.bottom} y2={HEIGHT - PADDING.bottom + 4}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                />
                <text
                  x={x} y={HEIGHT - PADDING.bottom + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="hsl(var(--muted-foreground))"
                  fontFamily="DM Sans, sans-serif"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Input markers (small green dots near top) */}
          {inputMarkers.map((m, i) => (
            <circle
              key={`in-${i}`}
              cx={xScale(m.day, chartWidth)}
              cy={PADDING.top - 8}
              r="3"
              fill="hsl(142 70% 45%)"
            >
              <title>{`${format(m.date, 'MMM d')} · Inputs · ${formatNaira(m.amount, { compact: true })}`}</title>
            </circle>
          ))}

          {/* Labour markers (slightly offset) */}
          {labourMarkers.map((m, i) => (
            <g key={`lab-${i}`}>
              <circle
                cx={xScale(m.day, chartWidth)}
                cy={PADDING.top - 8}
                r="3"
                fill="hsl(var(--muted-foreground))"
                opacity="0.7"
              >
                <title>{`${format(m.date, 'MMM d')} · Labour · ${formatNaira(m.amount, { compact: true })}`}</title>
              </circle>
            </g>
          ))}

          {/* Income markers — large gold dots on the line */}
          {incomeMarkers.map((m, i) => {
            const balanceAt = points.find(p => p.day === m.day)?.balance ?? 0;
            const cy = yScale(balanceAt, HEIGHT);
            return (
              <g key={`inc-${i}`}>
                <circle
                  cx={xScale(m.day, chartWidth)}
                  cy={cy}
                  r="6"
                  fill="hsl(var(--card))"
                  stroke="hsl(142 70% 45%)"
                  strokeWidth="2"
                />
                <circle
                  cx={xScale(m.day, chartWidth)}
                  cy={cy}
                  r="3"
                  fill="hsl(142 70% 45%)"
                >
                  <title>{`${format(m.date, 'MMM d')} · Harvest · ${formatNaira(m.amount, { compact: true })}`}</title>
                </circle>
              </g>
            );
          })}

          {/* Worst gap label */}
          {cashGaps.length > 0 && (() => {
            const worst = cashGaps.reduce((a, b) => (b.shortfallKobo > a.shortfallKobo ? b : a));
            const startDay = differenceInDays(parseISO(worst.startDate), today);
            const endDay = differenceInDays(parseISO(worst.endDate), today);
            const midDay = (startDay + endDay) / 2;
            const x = xScale(midDay, chartWidth);
            return (
              <g>
                <rect
                  x={x - 38} y={zeroY + 10}
                  width="76" height="20"
                  rx="4"
                  fill="rgba(249,115,22,0.95)"
                />
                <text
                  x={x} y={zeroY + 23}
                  textAnchor="middle"
                  fontSize="11"
                  fill="white"
                  fontFamily="DM Sans, sans-serif"
                  fontWeight="600"
                  className="tabular-nums"
                >
                  {formatNaira(worst.shortfallKobo, { compact: true })} gap
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
