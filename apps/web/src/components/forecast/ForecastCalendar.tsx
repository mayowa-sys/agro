import { useState, useMemo, useRef, useEffect } from 'react';
import {
  addDays, format, startOfDay, parseISO, isSameDay,
  isSameMonth, startOfMonth, addMonths, differenceInDays,
} from 'date-fns';
import { AlertTriangle, Hammer, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNaira } from '@/lib/format';

export interface ForecastEvent {
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'NEUTRAL';
  amount: number;
  category: string;
  label?: string;
  reasons?: string[];
}

export interface CashGap {
  startDate: string;
  endDate: string;
  shortfallKobo: number;
}

interface Props {
  events: ForecastEvent[];
  cashGaps: CashGap[];
  onDayClick?: (date: Date, events: ForecastEvent[]) => void;
}

type TabView = 'week' | 'month' | 'quarter';
const DAYS: Record<TabView, number> = { week: 7, month: 30, quarter: 90 };
const LEAF = 'hsl(142 70% 45%)';
const CLAY = '#a0522d';
const ORANGE = 'rgb(249,115,22)';
const TODAY_BLUE = '#3b82f6'; // distinguishes today from income (leaf-green)

function getDayRange(view: TabView): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: DAYS[view] }, (_, i) => addDays(today, i));
}

function groupByWeek(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  let current: Date[] = [];
  days.forEach((d, i) => {
    current.push(d);
    if (current.length === 7 || i === days.length - 1) {
      weeks.push(current);
      current = [];
    }
  });
  return weeks;
}

export function ForecastCalendar({ events, cashGaps, onDayClick }: Props) {
  const [view, setView] = useState<TabView>('quarter');
  const days = useMemo(() => getDayRange(view), [view]);
  const weeks = useMemo(() => groupByWeek(days), [days]);
  const today = useMemo(() => startOfDay(new Date()), []);

  // Track sticky month banner — which month is visible at top of viewport
  const [visibleMonth, setVisibleMonth] = useState<Date>(today);
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // ── Event indexing ─────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, ForecastEvent[]> = {};
    events.forEach((e) => {
      const key = e.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  // ── Gap predicates (END is exclusive — harvest day is NOT a gap day) ─
  const isInGap = (date: Date) =>
    cashGaps.some((gap) => {
      const start = startOfDay(parseISO(gap.startDate));
      const end = startOfDay(parseISO(gap.endDate));
      const d = startOfDay(date);
      return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
    });

  const isGapStart = (date: Date) =>
    cashGaps.some((gap) => isSameDay(date, parseISO(gap.startDate)));

  const gapForDate = (date: Date) =>
    cashGaps.find((gap) => {
      const start = startOfDay(parseISO(gap.startDate));
      const end = startOfDay(parseISO(gap.endDate));
      const d = startOfDay(date);
      return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
    });

  // ── Months covered by current view ─────────────────────────────────
  const monthsInRange = useMemo(() => {
    const months: { date: Date; key: string; label: string }[] = [];
    let cursor = startOfMonth(today);
    const end = days[days.length - 1] ?? today;
    while (cursor.getTime() <= end.getTime()) {
      months.push({
        date: cursor,
        key: format(cursor, 'yyyy-MM'),
        label: format(cursor, 'MMM'),
      });
      cursor = addMonths(cursor, 1);
    }
    return months;
  }, [days, today]);

  // ── Sticky month observer (uses scroll position relative to weeks) ──
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the topmost visible position
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const monthKey = (visible[0].target as HTMLElement).dataset.monthKey;
          if (monthKey) {
            const m = monthsInRange.find((m) => m.key === monthKey);
            if (m) setVisibleMonth(m.date);
          }
        }
      },
      { root: container, rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );

    Object.values(monthRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [monthsInRange, weeks]);

  const scrollToMonth = (monthKey: string) => {
    const el = monthRefs.current[monthKey];
    if (el && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const elTop = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: elTop - 60, behavior: 'smooth' });
    }
  };

  // ── Banner state ───────────────────────────────────────────────────
  const visibleMonthKey = format(visibleMonth, 'yyyy-MM');
  const gapInVisibleMonth = cashGaps.some((g) => {
    const s = parseISO(g.startDate), e = parseISO(g.endDate);
    return (isSameMonth(s, visibleMonth) || isSameMonth(e, visibleMonth)) ||
      (s.getTime() < visibleMonth.getTime() && e.getTime() > addMonths(visibleMonth, 1).getTime());
  });

  // Group weeks by their leading month for the dividers
  const weekGroups = useMemo(() => {
    const groups: { monthKey: string; monthDate: Date; label: string; weeks: Date[][] }[] = [];
    let currentGroup: typeof groups[0] | null = null;
    for (const week of weeks) {
      const firstDay = week[0];
      const key = format(firstDay, 'yyyy-MM');
      if (!currentGroup || currentGroup.monthKey !== key) {
        currentGroup = {
          monthKey: key,
          monthDate: startOfMonth(firstDay),
          label: format(firstDay, 'MMMM'),
          weeks: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.weeks.push(week);
    }
    return groups;
  }, [weeks]);

  return (
    <div className="space-y-4">
      {/* ── Top toolbar: title + view toggle ───────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans">
          Cash flow calendar
        </p>
        <div className="flex gap-1 bg-muted/60 rounded-lg p-1 border border-border">
          {(['week', 'month', 'quarter'] as TabView[]).map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 font-sans tracking-wide',
                view === t
                  ? 'bg-foreground text-background shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'week' ? '7D' : t === 'month' ? '30D' : '90D'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Jump-pill row ──────────────────────────────────────────── */}
      {monthsInRange.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {monthsInRange.map((m) => {
            const isCurrent = m.key === visibleMonthKey;
            const monthHasGap = cashGaps.some((g) => {
              const s = parseISO(g.startDate), e = parseISO(g.endDate);
              return isSameMonth(s, m.date) || isSameMonth(e, m.date) ||
                (s.getTime() < m.date.getTime() && e.getTime() > addMonths(m.date, 1).getTime());
            });
            return (
              <button
                key={m.key}
                onClick={() => scrollToMonth(m.key)}
                className={cn(
                  'flex-shrink-0 relative rounded-full px-3.5 py-1.5 text-[11px] font-semibold font-sans transition-all',
                  isCurrent
                    ? 'bg-leaf-500 text-white shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                {m.label}
                {monthHasGap && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                    style={{ background: ORANGE }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Sticky month banner ────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 -mx-6 px-6 py-3 backdrop-blur-md"
        style={{
          background: 'hsl(var(--card) / 0.92)',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-xl" style={{ color: 'hsl(var(--foreground))' }}>
              {format(visibleMonth, 'MMMM')}
            </h3>
            <span className="text-xs font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {format(visibleMonth, 'yyyy')}
            </span>
          </div>
          {gapInVisibleMonth && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full font-sans"
              style={{ background: 'rgba(249,115,22,0.12)', color: ORANGE }}
            >
              <AlertTriangle size={9} />
              Cash gap month
            </span>
          )}
        </div>
      </div>

      {/* ── DOW headers ────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1 px-0">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-sans py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Scrolling content: month-grouped weeks ────────────────── */}
      <div
        ref={scrollContainerRef}
        className="space-y-4 max-h-[640px] overflow-y-auto overflow-x-hidden px-1 py-1 -mx-1"
        style={{ scrollBehavior: 'smooth' }}
      >
        {weekGroups.map((group, gi) => (
          <div
            key={group.monthKey}
            ref={(el) => { monthRefs.current[group.monthKey] = el; }}
            data-month-key={group.monthKey}
            className="space-y-1"
          >
            {gi > 0 && (
              <div className="flex items-center gap-2 py-2 px-1">
                <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                <span className="text-[10px] uppercase tracking-[0.2em] font-sans font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {group.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
              </div>
            )}
            {group.weeks.map((week, wi) => (
              <div
                key={`${group.monthKey}-${wi}`}
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}
              >
                {week.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate[key] ?? [];
                  const net = dayEvents.reduce((s, e) => s + (e.type === 'EXPENSE' ? -e.amount : e.amount), 0);
                  const inGap = isInGap(day);
                  const gapStartHere = isGapStart(day);
                  const isToday = isSameDay(day, today);
                  const isFirstOfMonth = day.getDate() === 1;
                  const hasEvents = dayEvents.length > 0;
                  const isPositive = net >= 0;
                  const significantNet = Math.abs(net) >= 500_000; // ≥ ₦5k
                  const eventCount = dayEvents.length;

                  const hasIncome = dayEvents.some((e) => e.type === 'INCOME');
                  const hasExpense = dayEvents.some((e) => e.type === 'EXPENSE');
                  const hasLabour = dayEvents.some((e) => e.category === 'LABOUR');

                  // Left-bar color
                  const leftBarColor =
                    hasIncome && hasExpense ? null   // mixed — no bar
                    : hasIncome ? LEAF
                    : hasExpense ? CLAY
                    : null;

                  return (
                    <button
                      key={key}
                      onClick={() => hasEvents && onDayClick?.(day, dayEvents)}
                      className={cn(
                        'group relative flex flex-col items-center rounded-lg transition-all duration-150 min-h-[78px] pt-2 pb-2 px-1 overflow-hidden',
                        'border',
                        gapStartHere
                          ? 'border-orange-500/60 hover:bg-orange-500/[0.22]'
                          : inGap
                          ? 'border-orange-500/25 hover:bg-orange-500/[0.20]'
                          : hasEvents
                          ? 'border-border bg-card hover:bg-accent cursor-pointer'
                          : 'border-border/50 bg-background/40 hover:bg-accent/40',
                        isToday && 'ring-2',
                        !hasEvents && 'cursor-default',
                      )}
                      style={{
                        background: inGap ? 'rgba(249,115,22,0.15)' : undefined,
                        boxShadow: isToday ? `0 0 0 2px ${TODAY_BLUE}` : undefined,
                      }}
                    >
                      {/* Coloured left bar for income/expense */}
                      {leftBarColor && !inGap && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ background: leftBarColor, opacity: 0.55 }}
                        />
                      )}

                      {/* Day number / Month + day for first-of-month */}
                      <span
                        className={cn(
                          'leading-none font-sans tabular-nums mt-1',
                          isFirstOfMonth ? 'text-[10px] font-semibold' : 'text-base font-semibold',
                          hasEvents ? 'text-foreground' : 'text-muted-foreground'
                        )}
                        style={isToday ? { color: TODAY_BLUE } : undefined}
                      >
                        {isFirstOfMonth ? format(day, 'MMM d') : format(day, 'd')}
                      </span>

                      {/* TODAY chip */}
                      {isToday && (
                        <span
                          className="text-[8px] font-bold uppercase tracking-widest mt-0.5 px-1.5 py-0.5 rounded font-sans"
                          style={{ background: TODAY_BLUE, color: '#fff', lineHeight: 1 }}
                        >
                          Today
                        </span>
                      )}

                      {/* Net amount */}
                      {significantNet && !isToday && (
                        <>
                          <span className="block w-6 h-px bg-border mt-1.5 mb-1" />
                          <span
                            className="text-[12px] font-bold leading-none font-sans tabular-nums"
                            style={{ color: isPositive ? LEAF : 'hsl(var(--foreground))' }}
                          >
                            {isPositive ? '+' : '−'}{formatNaira(Math.abs(net), { compact: true })}
                          </span>
                        </>
                      )}
                      {significantNet && isToday && (
                        <span
                          className="text-[11px] font-bold leading-none font-sans tabular-nums mt-0.5"
                          style={{ color: isPositive ? LEAF : 'hsl(var(--foreground))' }}
                        >
                          {isPositive ? '+' : '−'}{formatNaira(Math.abs(net), { compact: true })}
                        </span>
                      )}

                      {/* Gap-start icon (top-right) */}
                      {gapStartHere && (
                        <span className="absolute top-1.5 right-1.5">
                          <AlertTriangle size={9} style={{ color: ORANGE }} />
                        </span>
                      )}

                      {/* Labour glyph (top-left, only when not a gap-start) */}
                      {hasLabour && !gapStartHere && (
                        <span className="absolute top-1.5 left-1.5">
                          <Hammer size={9} className="text-muted-foreground" />
                        </span>
                      )}

                      {/* Multi-event count badge (bottom-right) */}
                      {eventCount >= 2 && (
                        <span
                          className="absolute bottom-1 right-1 text-[8px] font-semibold tabular-nums font-sans px-1 rounded-sm leading-tight"
                          style={{
                            background: 'hsl(var(--muted))',
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {eventCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <span className="inline-block w-1 h-3 rounded-sm" style={{ background: LEAF, opacity: 0.55 }} />
          Income
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <span className="inline-block w-1 h-3 rounded-sm" style={{ background: CLAY, opacity: 0.55 }} />
          Expense
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: 'rgba(249,115,22,0.20)', border: '1px solid rgba(249,115,22,0.4)' }}
          />
          Cash gap
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <AlertTriangle size={11} style={{ color: ORANGE }} />
          Gap start
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <Hammer size={11} className="text-muted-foreground" />
          Labour day
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <span
            className="inline-block px-1 text-[8px] rounded-sm tabular-nums"
            style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
          >
            2
          </span>
          Multiple events
        </span>
      </div>
    </div>
  );
}
