import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ForecastCalendar, type ForecastEvent, type CashGap } from '@/components/forecast/ForecastCalendar';
import { ForecastReasonsDrawer } from '@/components/forecast/ForecastReasonsDrawer';
import { CumulativeCashChart } from '@/components/forecast/CumulativeCashChart';
import { CashGapBanner } from '@/components/forecast/CashGapBanner';
import { useForecast, useCashGaps, useRegenerateForecast } from '@/hooks/useForecast';
import { useNavigate } from 'react-router-dom';

export default function Forecast() {
  const nav = useNavigate();
  const { data: forecast, isLoading: fLoading } = useForecast();
  const { data: gapData } = useCashGaps();
  const regenerate = useRegenerateForecast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<ForecastEvent[]>([]);

  const events: ForecastEvent[] = forecast?.events ?? [];
  const gaps: CashGap[] = gapData?.gaps ?? [];

  const handleDayClick = (date: Date, evs: ForecastEvent[]) => {
    if (evs.length === 0) return;
    setSelectedDate(date);
    setSelectedEvents(evs);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Forecast</h1>
          <p className="text-sm text-slate-500">Next 90 days — AI-powered cash flow prediction</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${regenerate.isPending ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
      </div>

      {/* Cash gap banner */}
      <CashGapBanner
        gaps={gaps}
        onAdjustSplit={() => nav('/app/splits')}
        onRequestDeferral={() => nav('/app/deferrals')}
      />

      {/* Calendar */}
      {fLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <ForecastCalendar
          events={events}
          cashGaps={gaps}
          onDayClick={handleDayClick}
        />
      )}

      {/* Cumulative chart */}
      {!fLoading && <CumulativeCashChart events={events} />}

      {/* Reasons drawer */}
      <ForecastReasonsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        date={selectedDate}
        events={selectedEvents}
      />
    </div>
  );
}
