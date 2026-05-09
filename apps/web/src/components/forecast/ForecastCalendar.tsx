import { useState, useMemo } from 'react';
import { addDays, format, startOfDay, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNaira } from '@/lib/format';

export interface ForecastEvent {
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'NEUTRAL';
  amount: number;
  category: string;
  label?: string;
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
  const [view, setView] = useState<TabView>('month');
  const days = useMemo(() => getDayRange(view), [view]);
  const weeks = useMemo(() => groupByWeek(days), [days]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ForecastEvent[]> = {};
    events.forEach((e) => {
      const key = e.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const maxAmount = useMemo(() => {
    let max = 0;
    Object.values(eventsByDate).forEach((evs) => {
      const net = Math.abs(evs.reduce((s, e) => s + e.amount, 0));
      if (net > max) max = net;
    });
    return max || 1;
  }, [eventsByDate]);

  const isInGap = (date: Date) =>
    cashGaps.some((gap) =>
      isWithinInterval(date, {
        start: startOfDay(parseISO(gap.startDate)),
        end: startOfDay(parseISO(gap.endDate)),
      })
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans">Cash flow calendar</p>
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(['week', 'month', 'quarter'] as TabView[]).map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 font-sans capitalize',
                view === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'week' ? '7D' : t === 'month' ? '30D' : '90D'}
            </button>
          ))}
        </div>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-sans py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[key] ?? [];
              const net = dayEvents.reduce((s, e) => s + e.amount, 0);
              const inGap = isInGap(day);
              const isToday = isSameDay(day, new Date());
              const hasEvents = dayEvents.length > 0;
              const isPositive = net >= 0;
              const barH = net !== 0 ? Math.max(4, (Math.abs(net) / maxAmount) * 28) : 0;
              const hasSignificant = dayEvents.some((e) => Math.abs(e.amount) >= 500_000);

              return (
                <button
                  key={key}
                  onClick={() => onDayClick?.(day, dayEvents)}
                  className={cn(
                    'group relative flex flex-col items-center rounded-lg transition-all duration-150 min-h-[76px] pt-2.5 pb-2 px-1',
                    'border',
                    inGap
                      ? 'border-gold-500/40 bg-gold-500/5 hover:bg-gold-500/10'
                      : hasEvents
                      ? 'border-border bg-card hover:bg-accent cursor-pointer'
                      : 'border-border/50 bg-background/40 hover:bg-accent/40',
                    isToday && 'ring-1 ring-leaf-500/70'
                  )}
                >
                  {/* Day number */}
                  <span className={cn(
                    'text-[15px] font-semibold leading-none font-sans tabular-nums',
                    isToday ? 'text-leaf-500' : hasEvents ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>

                  {/* Bar — sits directly below number */}
                  <div className="w-full flex items-end justify-center px-2 mt-1.5">
                    {net !== 0 && (
                      <div
                        className={cn('w-full rounded-sm', isPositive ? 'bg-leaf-500' : 'bg-destructive/80')}
                        style={{ height: barH }}
                      />
                    )}
                  </div>

                  {/* Amount — tight below bar */}
                  {hasSignificant && (
                    <span className={cn(
                      'text-[10px] font-bold leading-none mt-1 font-sans tabular-nums',
                      isPositive ? 'text-leaf-500' : 'text-destructive'
                    )}>
                      {formatNaira(Math.abs(net), { compact: true })}
                    </span>
                  )}

                  {/* Gap indicator */}
                  {inGap && (
                    <span className="absolute top-1.5 right-1.5">
                      <AlertTriangle size={8} className="text-gold-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend — icons */}
      <div className="flex items-center gap-5 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <TrendingUp size={12} className="text-leaf-500" /> Income
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <TrendingDown size={12} className="text-destructive" /> Expense
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <AlertTriangle size={12} className="text-gold-500" /> Cash gap
        </span>
      </div>
    </div>
  );
}
