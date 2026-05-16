import { api } from '@/lib/api';
import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ForecastCalendar, type ForecastEvent, type CashGap } from '@/components/forecast/ForecastCalendar';
import { ForecastReasonsDrawer } from '@/components/forecast/ForecastReasonsDrawer';
import { CashGapBanner } from '@/components/forecast/CashGapBanner';
import { SeasonChart } from '@/components/forecast/SeasonChart';
import { StressTestConsole } from '@/components/forecast/StressTestConsole';
import { useForecast, useCashGaps, useRegenerateForecast, useStressTest, useProjectedBalance } from '@/hooks/useForecast';
import { useNavigate } from 'react-router-dom';

export default function Forecast() {
  const nav = useNavigate();
  const { data: forecast, isLoading: fLoading } = useForecast();
  const { data: gapData } = useCashGaps();
  const { data: balanceData } = useProjectedBalance();
  const regenerate = useRegenerateForecast();
  const stressTest = useStressTest();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ForecastEvent[]>([]);
  const [stressOpen, setStressOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [stressedForecast, setStressedForecast] = useState<any>(null);
  const chartKeyRef = useRef(0); // incremented on stress/reset to replay draw animation

  const { data: deferrals } = useQuery<any[]>({
    queryKey: ['deferrals', 'me'],
    queryFn: () => api.get('/deferrals/me').then(r => r.data),
  });
  const pendingDeferral = (deferrals ?? []).find((d: any) => d.status === 'PENDING');

  const normalise = (evs: any[]): ForecastEvent[] =>
      (evs ?? []).map((e) => ({
        ...e,
        date: e.date ?? e.expectedDate,
        amount: Number(e.amount ?? e.expectedAmount),
        reasons: e.reasonsJson ?? e.reasons ?? [],
      }));

  const baseEvents = normalise(forecast?.events ?? []);
  const activeEvents = stressedForecast ? normalise(stressedForecast.events ?? []) : baseEvents;

  const rawGaps: any[] = Array.isArray(gapData) ? gapData : (gapData?.gaps ?? []);
  const gaps: CashGap[] = rawGaps.map(g => ({
    startDate: g.startDate,
    endDate: g.endDate,
    shortfallKobo: Number(g.shortfallKobo ?? g.gapAmount ?? 0),
  }));

  const series = balanceData?.series ?? [];

  // When a stress scenario is active, recompute the balance series from
  // the stressed events so the chart line actually changes shape.
  // We replicate the same running-balance logic as the backend.
  const stressedSeries = useMemo(() => {
    if (!stressedForecast || !series.length) return null;
    const stressedEvents: ForecastEvent[] = normalise(stressedForecast.events ?? []);
    const today = new Date(); today.setUTCHours(0,0,0,0);
    const byDay = new Map<number, number>();
    for (const e of stressedEvents) {
      const d = new Date(e.date); d.setUTCHours(0,0,0,0);
      const offset = Math.round((d.getTime() - today.getTime()) / 86400000);
      if (offset < 0 || offset > 180) continue;
      const delta = e.type === 'INCOME' ? e.amount : -e.amount;
      byDay.set(offset, (byDay.get(offset) ?? 0) + delta);
    }
    // Start from the same balance the live series starts from
    // so the stressed chart is comparable to the live chart.
    let running = series.length > 0 ? Number(series[0].balanceKobo) : 15000000;
    return series.map((p: any) => ({
      ...p,
      balanceKobo: (() => {
        running += byDay.get(p.day) ?? 0;
        return running.toString();
      })(),
    }));
  }, [stressedForecast, series]);

  const activeSeries = stressedForecast && stressedSeries ? stressedSeries : series;

  const actualGap = useMemo(() => {
    if (activeSeries.length === 0) return null;
    let minBal = 0;
    let gapStart = '';
    let gapEnd = '';
    let inGap = false;
    for (const p of activeSeries) {
      const bal = Number(p.balanceKobo);
      if (bal < minBal) minBal = bal;
      if (!inGap && bal < 0) {
        gapStart = p.date;
        inGap = true;
      }
      if (inGap && bal >= 0) {
        gapEnd = p.date;
        break;
      }
    }
    if (!gapStart) return null;
    if (!gapEnd) gapEnd = activeSeries[activeSeries.length - 1].date;
    return {
      shortfallKobo: Math.abs(Math.round(minBal)),
      startDate: gapStart,
      endDate: gapEnd,
    };
  }, [activeSeries]);

  const horizonDays = balanceData?.horizonDays ?? 180;

  const handleDayClick = (date: Date, evs: ForecastEvent[]) => {
    if (!evs.length) return;
    setSelectedDate(date);
    setSelectedEvents(evs);
    setDrawerOpen(true);
  };

  const handleMarkerClick = (date: Date, evs: ForecastEvent[]) => {
    setSelectedDate(date);
    setSelectedEvents(evs);
    setDrawerOpen(true);
  };

  const handleRunStress = async (scenario: string) => {
    const result = await stressTest.mutateAsync(scenario);
    setActiveScenario(scenario);
    setStressedForecast(result);
    chartKeyRef.current += 1; // triggers SeasonChart draw animation
  };

  const chartGaps = actualGap
    ? [{ startDate: actualGap.startDate, endDate: actualGap.endDate, shortfallKobo: actualGap.shortfallKobo }]
    : [];

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Page header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-1.5">
              {activeScenario
                ? `Stress test · ${activeScenario.replace(/_/g, ' ')}`
                : 'AI-powered · 180-day outlook'}
            </p>
            <h1 className="font-display text-5xl text-foreground leading-none">Forecast</h1>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <button
              onClick={() => setStressOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-accent px-4 py-2 text-sm text-foreground font-sans transition-all"
            >
              <Zap size={13} className="text-gold-500" />
              Stress test
            </button>
            <button
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
              className="flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-accent px-4 py-2 text-sm text-foreground font-sans transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={regenerate.isPending ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>
        </div>

        {/* Detailed projected balance chart */}
        {fLoading || series.length === 0 ? (
          <Skeleton className="h-[380px] w-full rounded-2xl" />
        ) : (
          <SeasonChart
            series={activeSeries}
            events={activeEvents}
            cashGaps={chartGaps}
            horizonDays={horizonDays}
            onMarkerClick={handleMarkerClick}
            chartKey={chartKeyRef.current}
          />
        )}

        {/* Cash gap banner */}
        <CashGapBanner
            gaps={chartGaps}
            pendingDeferral={pendingDeferral}
            onAdjustSplit={() => nav('/app/splits')}
            onRequestDeferral={() => nav('/app/deferrals')}
        />

        {/* Cash flow calendar */}
        <div className="rounded-2xl border border-border bg-card p-6">
          {fLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <ForecastCalendar events={activeEvents} cashGaps={chartGaps} onDayClick={handleDayClick} />
          )}
        </div>
      </div>

      <ForecastReasonsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        date={selectedDate}
        events={selectedEvents}
      />

      <StressTestConsole
        open={stressOpen}
        onClose={() => setStressOpen(false)}
        onRun={handleRunStress}
        onReset={() => { setActiveScenario(null); setStressedForecast(null); chartKeyRef.current += 1; }}
        isLoading={stressTest.isPending}
        activeScenario={activeScenario}
        result={stressedForecast}
      />
    </div>
  );
}
