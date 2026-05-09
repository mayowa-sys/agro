import { useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ForecastCalendar, type ForecastEvent, type CashGap } from '@/components/forecast/ForecastCalendar';
import { ForecastReasonsDrawer } from '@/components/forecast/ForecastReasonsDrawer';
import { CumulativeCashChart } from '@/components/forecast/CumulativeCashChart';
import { CashGapBanner } from '@/components/forecast/CashGapBanner';
import { StressTestConsole } from '@/components/forecast/StressTestConsole';
import { useForecast, useCashGaps, useRegenerateForecast, useStressTest } from '@/hooks/useForecast';
import { useNavigate } from 'react-router-dom';

export default function Forecast() {
  const nav = useNavigate();
  const { data: forecast, isLoading: fLoading } = useForecast();
  const { data: gapData } = useCashGaps();
  const regenerate = useRegenerateForecast();
  const stressTest = useStressTest();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ForecastEvent[]>([]);
  const [stressOpen, setStressOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [stressedForecast, setStressedForecast] = useState<any>(null);

  const normalise = (evs: any[]): ForecastEvent[] =>
    (evs ?? []).map((e) => ({
      ...e,
      date: e.date ?? e.expectedDate,
      amount: Number(e.amount ?? e.expectedAmount),
    }));

  const baseEvents = normalise(forecast?.events ?? []);
  const activeEvents = stressedForecast ? normalise(stressedForecast.events ?? []) : baseEvents;
  const gaps: CashGap[] = gapData?.gaps ?? [];

  const handleDayClick = (date: Date, evs: ForecastEvent[]) => {
    if (!evs.length) return;
    setSelectedDate(date);
    setSelectedEvents(evs);
    setDrawerOpen(true);
  };

  const handleRunStress = async (scenario: string) => {
    const result = await stressTest.mutateAsync(scenario);
    setActiveScenario(scenario);
    setStressedForecast(result);
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Page header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-1.5">
              {activeScenario
                ? `Stress test · ${activeScenario.replace(/_/g, ' ')}`
                : 'AI-powered · 90-day outlook'}
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

        {/* Cash gap banner */}
        <CashGapBanner
          gaps={gaps}
          onAdjustSplit={() => nav('/app/splits')}
          onRequestDeferral={() => nav('/app/deferrals')}
        />

        {/* Calendar card */}
        <div className="rounded-xl border border-border bg-card p-6">
          {fLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <ForecastCalendar events={activeEvents} cashGaps={gaps} onDayClick={handleDayClick} />
          )}
        </div>

        {/* Chart card */}
        {!fLoading && (
          <div className="rounded-xl border border-border bg-card p-6">
            <CumulativeCashChart events={activeEvents} />
          </div>
        )}
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
        onReset={() => { setActiveScenario(null); setStressedForecast(null); }}
        isLoading={stressTest.isPending}
        activeScenario={activeScenario}
        result={stressedForecast}
      />
    </div>
  );
}
