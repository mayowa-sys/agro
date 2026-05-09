import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
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
      return {
        date: format(date, 'MMM d'),
        cumulative: cumulative / 100,
        upper: (cumulative * 1.15) / 100,
        lower: (cumulative * 0.85) / 100,
      };
    });
  }, [events, days]);

  const hasGap = data.some((d) => d.cumulative < 0);

  const formatYAxis = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `₦${(v / 1_000).toFixed(0)}k`;
    return `₦${v}`;
  };

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-slate-500 mb-2">Cumulative cash position — next {days} days</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#86efac" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#86efac" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            interval={Math.floor(days / 6)}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
              formatter={(val) => [formatNaira((Number(val) * 100), { compact: false }), '']}
            labelStyle={{ fontSize: 11 }}
            contentStyle={{ fontSize: 11 }}
          />
          {/* CI band */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="url(#ciGradient)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
          />
          {/* Zero line */}
          <ReferenceLine y={0} stroke={hasGap ? '#f59e0b' : '#e2e8f0'} strokeWidth={hasGap ? 2 : 1} strokeDasharray="4 2" />
          {/* Cumulative line */}
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#16a34a"
            strokeWidth={2}
            fill="none"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
