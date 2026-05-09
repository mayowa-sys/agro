import { useState } from 'react';
import { RefreshCw, Zap, Info } from 'lucide-react';
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
  const [chartInfoOpen, setChartInfoOpen] = useState(false);

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
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ fontFamily: '"DM Serif Display", serif' }}>
                    Cash position over 90 days
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cumulative projected balance with confidence band
                  </p>
                </div>
                <button
                    onClick={() => setChartInfoOpen(true)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'hsl(var(--muted))' }}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
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
      {chartInfoOpen && (
          <div
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
              onClick={() => setChartInfoOpen(false)}
          >
            <div
                className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                style={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                }}
                onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button
                  onClick={() => setChartInfoOpen(false)}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  style={{ backgroundColor: 'hsl(var(--muted))' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Icon */}
              <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}
              >
                <Info className="w-5 h-5 text-leaf-500" />
              </div>

              {/* Title */}
              <h2
                  className="text-xl font-bold mb-1 tracking-tight"
                  style={{ fontFamily: '"DM Serif Display", serif' }}
              >
                Cash position over 90 days
              </h2>
              <div className="h-px w-12 mb-4 bg-leaf-500 rounded-full" />

              {/* Body */}
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  This chart shows your{' '}
                  <strong className="text-foreground">predicted cumulative cash position</strong> over
                  the next 90 days — how much money you are expected to have available at any point.
                </p>
                <p>
                  The <strong className="text-foreground">shaded band</strong> above the line is the
                  confidence interval — the optimistic scenario based on Prophet's upper forecast
                  bound. A wider band means more uncertainty in that period.
                </p>
                <p>
                  When the line{' '}
                  <strong className="text-foreground">dips toward zero</strong>, that is a predicted
                  cash gap. The gold banner at the top flags these and suggests actions you can take.
                </p>
                <p>
                  The forecast is regenerated nightly using your crop playbook, historical payment
                  data, and seasonal patterns.
                </p>
                <p
                    className="text-xs pt-3 border-t"
                    style={{ borderColor: 'hsl(var(--border))' }}
                >
                  Projections are based on Prophet time-series modelling. Actual results will vary.
                </p>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
