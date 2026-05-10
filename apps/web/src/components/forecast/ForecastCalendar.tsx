import { useState, useMemo } from 'react';
import { addDays, format, startOfDay, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
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

  const isInGap = (date: Date) =>
    cashGaps.some((gap) =>
      isWithinInterval(date, {
        start: startOfDay(parseISO(gap.startDate)),
        end: startOfDay(parseISO(gap.endDate)),
      })
    );
  const isGapStart = (date: Date) =>
    cashGaps.some((gap) => isSameDay(date, parseISO(gap.startDate)));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans">Cash flow calendar</p>
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
              const hasSignificant = dayEvents.some((e) => Math.abs(e.amount) >= 500_000);

              return (
                <button
                  key={key}
                  onClick={() => onDayClick?.(day, dayEvents)}
                  className={cn(
                    'group relative flex flex-col items-center rounded-lg transition-all duration-150 min-h-[76px] pt-2.5 pb-2 px-1',
                    'border',
                    isGapStart(day)
                      ? 'border-orange-500/60 bg-orange-500/[0.12] hover:bg-orange-500/[0.18]'
                      : inGap
                      ? 'border-orange-500/15 bg-orange-500/[0.05] hover:bg-orange-500/[0.08]'
                      : hasEvents
                      ? 'border-border bg-card hover:bg-accent cursor-pointer'
                      : 'border-border/50 bg-background/40 hover:bg-accent/40',
                    isToday && 'ring-1 ring-leaf-500/70'
                  )}
                >
                  {/* Day number */}
                  <span className={cn(
                      'text-base font-semibold leading-none font-sans tabular-nums mt-1',
                      isToday ? 'text-leaf-500' : hasEvents ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>

                  {/* Amount with separator */}
                  {hasSignificant && (
                      <>
                        <span className="block w-6 h-px bg-border mt-2 mb-1.5" />
                        <span className="text-[13px] font-bold leading-none font-sans tabular-nums text-foreground">
                        {isPositive ? '+' : '−'}{formatNaira(Math.abs(net), { compact: true })}
                      </span>
                      </>
                  )}

                  {/* Gap indicator — only on gap start */}
                  {isGapStart(day) && (
                      <span className="absolute top-1.5 right-1.5">
                      <AlertTriangle size={9} className="text-orange-500" />
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
          <span className="text-leaf-600 font-bold">+</span> Income day
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <span className="text-destructive font-bold">−</span> Expense day
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
          <AlertTriangle size={11} className="text-gold-500" /> Cash gap
        </span>
      </div>
    </div>
  );
}
