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
        lower: naira * 0.88,
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
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ciUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'DM Sans' }}
            tickLine={false}
            axisLine={false}
            interval={Math.floor(days / 5)}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 9, fill: '#52525b', fontFamily: 'DM Sans' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            formatter={(val) => [formatNaira(Number(val) * 100), '']}
            contentStyle={{
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'DM Sans',
              color: '#e4e4e7',
            }}
            labelStyle={{ color: '#71717a', fontSize: 10 }}
            cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
          />
          <ReferenceLine
            y={0}
            stroke={hasGap ? '#f59e0b' : '#3f3f46'}
            strokeWidth={hasGap ? 1.5 : 1}
            strokeDasharray="3 3"
          />
          <Area type="monotone" dataKey="upper" stroke="none" fill="url(#ciUp)" fillOpacity={1} />
          <Area type="monotone" dataKey="lower" stroke="none" fill="#09090b" fillOpacity={1} />
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
