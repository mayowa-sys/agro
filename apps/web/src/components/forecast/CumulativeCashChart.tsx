import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { addDays, format, startOfDay } from 'date-fns';
import { formatNaira } from '@/lib/format';
import type { ForecastEvent } from './ForecastCalendar';

interface Props {
  events: ForecastEvent[];
  days?: number;
}

export function CumulativeCashChart({ events, days = 90 }: Props) {
  const data = useMemo(() => {
    const today = startOfDay(new Date());
    const eventMap: Record<string, number> = {};
    events.forEach((e) => {
      const key = e.date.slice(0, 10);
      eventMap[key] = (eventMap[key] ?? 0) + e.amount;
    });
    let cumulative = 0;
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, i);
      const key = format(date, 'yyyy-MM-dd');
      cumulative += eventMap[key] ?? 0;
      const naira = cumulative / 100;
      return {
        date: format(date, 'MMM d'),
        cumulative: naira,
        upper: naira * 1.12,
      };
    });
  }, [events, days]);

  const hasGap = data.some((d) => d.cumulative < 0);

  const fmtY = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
    return `₦${v}`;
  };

  return (
    <div className="w-full">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-sans mb-3">
        Cumulative position · {days}-day outlook
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="ciUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'DM Sans' }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(days / 5)}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontFamily: 'DM Sans' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
              formatter={(val, name) => {
                if (name === 'upper') return [formatNaira(Number(val) * 100), 'Optimistic'];
                if (name === 'cumulative') return [formatNaira(Number(val) * 100), 'Projected'];
                return [formatNaira(Number(val) * 100), name];
              }}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'DM Sans',
              color: 'hsl(var(--popover-foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
          />
          <ReferenceLine
            y={0}
            stroke={hasGap ? '#f59e0b' : '#3f3f46'}
            strokeWidth={hasGap ? 1.5 : 1}
            strokeDasharray="3 3"
          />
          <Area type="monotone" dataKey="upper" stroke="none" fill="url(#ciUp)" fillOpacity={1} />upper: naira * 1.12,
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="none"
            dot={false}
            activeDot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
