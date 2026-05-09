import { useState, useMemo } from 'react';
import { addDays, format, startOfDay, isWithinInterval, parseISO, isSameDay } from 'date-fns';import { cn } from '@/lib/cn';
import { formatNaira } from '@/lib/format';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ForecastEvent {
  date: string; // ISO string
  type: 'INCOME' | 'EXPENSE' | 'NEUTRAL';
  amount: number; // kobo, signed (negative = expense)
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
  const count = DAYS[view];
  return Array.from({ length: count }, (_, i) => addDays(today, i));
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

const MAX_BAR_HEIGHT = 32; // px

export function ForecastCalendar({ events, cashGaps, onDayClick }: Props) {
  const [view, setView] = useState<TabView>('month');

  const days = useMemo(() => getDayRange(view), [view]);
  const weeks = useMemo(() => groupByWeek(days), [days]);

  // Pre-index events by date string for O(1) lookup
  const eventsByDate = useMemo(() => {
    const map: Record<string, ForecastEvent[]> = {};
    events.forEach((e) => {
      const key = e.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  // Max absolute amount across all days for scaling bars
  const maxAmount = useMemo(() => {
    let max = 0;
    Object.values(eventsByDate).forEach((evs) => {
      const net = Math.abs(evs.reduce((s, e) => s + e.amount, 0));
      if (net > max) max = net;
    });
    return max || 1;
  }, [eventsByDate]);

  const isInGap = (date: Date): CashGap | null => {
    for (const gap of cashGaps) {
      if (
        isWithinInterval(date, {
          start: startOfDay(parseISO(gap.startDate)),
          end: startOfDay(parseISO(gap.endDate)),
        })
      )
        return gap;
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <Tabs value={view} onValueChange={(v) => setView(v as TabView)}>
        <TabsList>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="quarter">Quarter</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto">
        <div className="space-y-1 min-w-0">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
              {week.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate[key] ?? [];
                const net = dayEvents.reduce((s, e) => s + e.amount, 0);
                const gap = isInGap(day);
                const isPositive = net >= 0;
                const barHeight = maxAmount > 0 ? Math.max(2, (Math.abs(net) / maxAmount) * MAX_BAR_HEIGHT) : 0;
                const hasSignificant = dayEvents.some((e) => Math.abs(e.amount) >= 500_000); // ₦5k

                return (
                  <button
                    key={key}
                    onClick={() => onDayClick?.(day, dayEvents)}
                    className={cn(
                      'relative flex flex-col items-center rounded-md border px-1 py-1 text-center transition-colors hover:bg-slate-50 cursor-pointer',
                      gap ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-white',
                      isSameDay(day, new Date()) && 'ring-2 ring-leaf-600'
                    )}
                    style={{ minHeight: 72 }}
                  >
                    {/* Date label */}
                    <span className={cn('text-[10px] font-medium leading-none', isSameDay(day, new Date()) ? 'text-leaf-700' : 'text-slate-400')}>
                      {format(day, 'd')}
                    </span>
                    <span className="text-[9px] text-slate-300 leading-none mb-1">{format(day, 'EEE')}</span>

                    {/* Cash flow bar */}
                    {net !== 0 && (
                      <div className="w-full flex justify-center">
                        <div
                          className={cn(
                            'w-4/5 rounded-sm transition-all',
                            isPositive ? 'bg-leaf-500' : 'bg-red-400'
                          )}
                          style={{ height: barHeight }}
                        />
                      </div>
                    )}

                    {/* Significant event label */}
                    {hasSignificant && (
                      <span
                        className={cn(
                          'mt-1 w-full text-center text-[8px] font-semibold truncate rounded px-0.5 leading-tight',
                          isPositive ? 'bg-leaf-100 text-leaf-800' : 'bg-red-100 text-red-800'
                        )}
                      >
                        {formatNaira(Math.abs(net), { compact: true })}
                      </span>
                    )}

                    {/* Gap indicator */}
                    {gap && (
                      <span className="absolute bottom-0.5 left-0 right-0 text-[7px] text-amber-600 font-medium text-center leading-none">
                        gap
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-leaf-500 inline-block" /> Income</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Expense</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300 inline-block" /> Cash gap</span>
      </div>
    </div>
  );
}
