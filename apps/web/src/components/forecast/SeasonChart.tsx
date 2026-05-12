import { useMemo, useState, useEffect, useRef } from 'react';
import { format, parseISO, addMonths, startOfMonth, differenceInDays } from 'date-fns';
import { TrendingUp, TrendingDown, Sprout, Hammer, AlertCircle } from 'lucide-react';
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
  onMarkerClick?: (date: Date, events: ForecastEvent[]) => void;
}

const PADDING = { top: 32, right: 24, bottom: 40, left: 64 };
const HEIGHT = 320;

// Animation timing (ms)
const LINE_DRAW_MS = 1400;
const AREA_FADE_MS = 600;
const AREA_DELAY_MS = 700;
const MARKER_STAGGER_MS = 60;
const MARKER_DELAY_MS = 1100;

type MarkerKind = 'income' | 'inputs' | 'labour' | 'special';

interface Marker {
  kind: MarkerKind;
  date: Date;
  day: number;
  events: ForecastEvent[]; // all events on this day matching the category
  totalAmount: number;
}

export function SeasonChart({ series, events, cashGaps, horizonDays, onMarkerClick }: Props) {
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
    min -= span * 0.10;
    max += span * 0.08;
    return { minBal: min, maxBal: max };
  }, [points]);

  const chartWidth = 1000;
  const innerW = chartWidth - PADDING.left - PADDING.right;

  const xScale = (day: number) =>
    PADDING.left + (day / horizonDays) * innerW;
  const yScale = (balance: number) => {
    const range = maxBal - minBal || 1;
    return PADDING.top + (1 - (balance - minBal) / range) * (HEIGHT - PADDING.top - PADDING.bottom);
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

  const zeroY = yScale(0);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.day).toFixed(2)} ${yScale(p.balance).toFixed(2)}`)
      .join(' ');
  }, [points, minBal, maxBal, horizonDays]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.day).toFixed(2)} ${yScale(p.balance).toFixed(2)}`).join(' ');
    const close = `L ${xScale(points[points.length - 1].day).toFixed(2)} ${zeroY.toFixed(2)} L ${xScale(points[0].day).toFixed(2)} ${zeroY.toFixed(2)} Z`;
    return top + ' ' + close;
  }, [points, minBal, maxBal, horizonDays, zeroY]);

  // ── Marker construction ────────────────────────────────────────────
  const markers = useMemo<Marker[]>(() => {
    const byDay = new Map<string, ForecastEvent[]>();
    for (const e of events) {
      const day = differenceInDays(parseISO(e.date), today);
      if (day < 0 || day > horizonDays) continue;
      const k = `${day}`;
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }

    const list: Marker[] = [];
    byDay.forEach((dayEvents, k) => {
      const day = Number(k);
      const date = new Date(today.getTime() + day * 86400000);

      // Group by kind so a single day can render multiple marker types
      const groups: Record<MarkerKind, ForecastEvent[]> = { income: [], inputs: [], labour: [], special: [] };
      for (const e of dayEvents) {
        if (e.type === 'INCOME') groups.income.push(e);
        else if (e.category === 'INPUTS') groups.inputs.push(e);
        else if (e.category === 'LABOUR') groups.labour.push(e);
        else if (e.category === 'HOUSEHOLD' && Math.abs(e.amount) >= 3_000_000) groups.special.push(e);
      }

      (Object.keys(groups) as MarkerKind[]).forEach(kind => {
        if (groups[kind].length === 0) return;
        const totalAmount = groups[kind].reduce((s, e) => s + Math.abs(e.amount), 0);
        list.push({ kind, date, day, events: groups[kind], totalAmount });
      });
    });

    return list.sort((a, b) => a.day - b.day);
  }, [events, today, horizonDays]);

  const finalBalance = points[points.length - 1]?.balance ?? 0;
  const isPositiveOutlook = finalBalance >= 0;

  // ── Animation state ────────────────────────────────────────────────
  const linePathRef = useRef<SVGPathElement | null>(null);
  const [pathLength, setPathLength] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    // Restart animation when the data changes meaningfully
    setAnimationKey(k => k + 1);
    if (linePathRef.current) {
      setPathLength(linePathRef.current.getTotalLength());
    }
  }, [linePath]);

  // ── Hover state ────────────────────────────────────────────────────
  const [hoveredMarker, setHoveredMarker] = useState<Marker | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl px-6 pt-5 pb-3 relative" style={{
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
    }}>
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Projected working balance
          </p>
          <p className="text-sm font-sans mt-1" style={{ color: 'hsl(var(--foreground))' }}>
            {format(today, 'MMM d')} – {format(new Date(today.getTime() + horizonDays * 86400000), 'MMM d, yyyy')}
            <span className="ml-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>· {horizonDays} days</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: 'hsl(142 70% 45%)' }} /> Inputs
          </span>
          <span className="flex items-center gap-1.5">
            <Hammer size={11} style={{ color: '#a0522d' }} /> Labour
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#d97706' }} /> One-off
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(142 70% 45%)', boxShadow: '0 0 0 2px hsl(var(--card)), 0 0 0 3px hsl(142 70% 45%)' }} /> Harvest
          </span>
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
              <stop offset="0%" stopColor="hsl(142 70% 45%)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(142 70% 45%)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="negativeArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(249,115,22)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="rgb(249,115,22)" stopOpacity="0.25" />
            </linearGradient>
            <clipPath id="aboveZero">
              <rect x="0" y="0" width={chartWidth} height={zeroY} />
            </clipPath>
            <clipPath id="belowZero">
              <rect x="0" y={zeroY} width={chartWidth} height={HEIGHT - zeroY} />
            </clipPath>
          </defs>

          {/* Y-axis grid lines */}
          {yTicks.map((tick, i) => {
            const y = yScale(tick);
            const isZero = Math.abs(tick) < 1;
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={PADDING.left} x2={chartWidth - PADDING.right}
                  y1={y} y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth={isZero ? '1' : '0.5'}
                  strokeDasharray={isZero ? '0' : '3 3'}
                  opacity={isZero ? 0.7 : 0.35}
                />
                <text
                  x={PADDING.left - 10} y={y + 3}
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

          {/* Cash gap shading */}
          {cashGaps.map((gap, i) => {
            const startDay = differenceInDays(parseISO(gap.startDate), today);
            const endDay = differenceInDays(parseISO(gap.endDate), today);
            const x1 = xScale(Math.max(0, startDay));
            const x2 = xScale(Math.min(horizonDays, endDay));
            return (
              <g key={`gap-${i}`} style={{ animation: `fadeIn ${AREA_FADE_MS}ms ease-out ${AREA_DELAY_MS + 300}ms both` }}>
                <rect
                  x={x1} y={PADDING.top}
                  width={Math.max(1, x2 - x1)}
                  height={HEIGHT - PADDING.top - PADDING.bottom}
                  fill="rgb(249,115,22)"
                  opacity="0.06"
                />
                {/* Vertical dotted lines at gap edges */}
                <line x1={x1} x2={x1} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="rgb(249,115,22)" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
                <line x1={x2} x2={x2} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="rgb(249,115,22)" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
              </g>
            );
          })}

          {/* Area fills */}
          <g style={{ animation: `fadeIn ${AREA_FADE_MS}ms ease-out ${AREA_DELAY_MS}ms both`, opacity: 0 }} key={`area-${animationKey}`}>
            <path d={areaPath} fill="url(#positiveArea)" clipPath="url(#aboveZero)" />
            <path d={areaPath} fill="url(#negativeArea)" clipPath="url(#belowZero)" />
          </g>

          {/* Animated main line */}
          <path
            ref={linePathRef}
            key={`line-${animationKey}`}
            d={linePath}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={pathLength}
            style={{
              animation: pathLength ? `draw ${LINE_DRAW_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards` : undefined,
            }}
          />

          {/* Today vertical marker */}
          <g style={{ animation: `fadeIn ${AREA_FADE_MS}ms ease-out ${AREA_DELAY_MS}ms both`, opacity: 0 }} key={`today-${animationKey}`}>
            <line
              x1={xScale(0)} x2={xScale(0)}
              y1={PADDING.top} y2={HEIGHT - PADDING.bottom}
              stroke="hsl(142 70% 45%)"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.7"
            />
            <text
              x={xScale(0) + 5}
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
          </g>

          {/* Month axis ticks */}
          {monthTicks.map((tick, i) => {
            const x = xScale(tick.day);
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

          {/* Markers on the line */}
          {markers.map((m, i) => {
            const balanceAt = points.find(p => p.day === m.day)?.balance ?? 0;
            const cx = xScale(m.day);
            const cy = yScale(balanceAt);
            const delay = MARKER_DELAY_MS + i * MARKER_STAGGER_MS;
            const onEnter = (e: React.MouseEvent<SVGElement>) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              const ratio = chartWidth / rect.width;
              setHoveredMarker(m);
              setTooltipPos({ x: cx / ratio, y: cy / ratio });
            };
            const onLeave = () => { setHoveredMarker(null); setTooltipPos(null); };
            const onClickMarker = () => { if (onMarkerClick) onMarkerClick(m.date, m.events); };

            const cursor = onMarkerClick ? 'pointer' : 'default';

            if (m.kind === 'income') {
              return (
                <g
                  key={`m-${i}`}
                  style={{ animation: `popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`, cursor }}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                  onClick={onClickMarker}
                >
                  <circle cx={cx} cy={cy} r="9" fill="hsl(var(--card))" />
                  <circle cx={cx} cy={cy} r="7" fill="hsl(142 70% 45%)" stroke="hsl(142 70% 45%)" strokeWidth="2" />
                  <circle cx={cx} cy={cy} r="3.5" fill="white" />
                </g>
              );
            }
            if (m.kind === 'inputs') {
              return (
                <g
                  key={`m-${i}`}
                  style={{ animation: `popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`, cursor }}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                  onClick={onClickMarker}
                >
                  <circle cx={cx} cy={cy} r="6" fill="hsl(var(--card))" />
                  <circle cx={cx} cy={cy} r="4.5" fill="hsl(var(--card))" stroke="hsl(142 70% 45%)" strokeWidth="2" />
                </g>
              );
            }
            if (m.kind === 'labour') {
              return (
                <g
                  key={`m-${i}`}
                  style={{ animation: `popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`, cursor }}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                  onClick={onClickMarker}
                >
                  <circle cx={cx} cy={cy} r="6" fill="hsl(var(--card))" />
                  <circle cx={cx} cy={cy} r="4.5" fill="#a0522d" />
                </g>
              );
            }
            // special — orange diamond
            return (
              <g
                key={`m-${i}`}
                style={{ animation: `popIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`, cursor }}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
                onClick={onClickMarker}
              >
                <rect x={cx - 5} y={cy - 5} width="10" height="10" fill="hsl(var(--card))" transform={`rotate(45 ${cx} ${cy})`} />
                <rect x={cx - 4} y={cy - 4} width="8" height="8" fill="#d97706" transform={`rotate(45 ${cx} ${cy})`} />
              </g>
            );
          })}

          {/* Worst gap label */}
          {cashGaps.length > 0 && (() => {
            const worst = cashGaps.reduce((a, b) => (b.shortfallKobo > a.shortfallKobo ? b : a));
            const startDay = differenceInDays(parseISO(worst.startDate), today);
            const endDay = differenceInDays(parseISO(worst.endDate), today);
            const midDay = (startDay + endDay) / 2;
            const x = xScale(midDay);
            return (
              <g style={{ animation: `fadeIn 500ms ease-out ${MARKER_DELAY_MS + 400}ms both`, opacity: 0 }}>
                <rect
                  x={x - 56} y={zeroY + 14}
                  width="112" height="22"
                  rx="11"
                  fill="rgba(249,115,22,0.95)"
                />
                <text
                  x={x} y={zeroY + 28}
                  textAnchor="middle"
                  fontSize="11"
                  fill="white"
                  fontFamily="DM Sans, sans-serif"
                  fontWeight="600"
                  className="tabular-nums"
                >
                  Short {formatNaira(worst.shortfallKobo, { compact: true })} · {Math.abs(differenceInDays(parseISO(worst.endDate), parseISO(worst.startDate)))}d
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Rich tooltip overlay */}
        {hoveredMarker && tooltipPos && (
          <div
            className="absolute pointer-events-none z-10 rounded-lg shadow-lg px-3 py-2 text-xs"
            style={{
              left: `${(tooltipPos.x / chartWidth) * 100}%`,
              top: `${(tooltipPos.y / HEIGHT) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 14px))',
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              minWidth: 180,
              maxWidth: 240,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {format(hoveredMarker.date, 'MMM d, yyyy')}
              </span>
              <span className="font-semibold tabular-nums">
                {hoveredMarker.kind === 'income' ? '+' : '−'}{formatNaira(hoveredMarker.totalAmount, { compact: true })}
              </span>
            </div>
            <div className="text-[11px] font-medium mb-1">
              {hoveredMarker.kind === 'income' ? 'Harvest payment' :
                hoveredMarker.kind === 'inputs' ? 'Crop inputs' :
                hoveredMarker.kind === 'labour' ? 'Labour cost' :
                'One-off expense'}
            </div>
            {hoveredMarker.events[0]?.reasons && hoveredMarker.events[0].reasons.length > 0 && (
              <div className="text-[10px] leading-snug" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {hoveredMarker.events[0].reasons[0]}
              </div>
            )}
            {onMarkerClick && (
              <div className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'hsl(142 70% 45%)' }}>
                <AlertCircle size={9} /> Click for details
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.2); }
          60% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
