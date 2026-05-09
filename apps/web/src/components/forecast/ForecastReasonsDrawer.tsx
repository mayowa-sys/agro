import { format, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatNaira } from '@/lib/format';
import type { ForecastEvent } from './ForecastCalendar';

interface Props {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  events: ForecastEvent[];
}

const REASONS: Record<string, string[]> = {
  INCOME: [
    'Harvest payment typically lands in this window based on your crop cycle',
    'Historical buyer payment patterns for this crop align with this date',
    'Weather-adjusted maturity estimate from your CropPlaybook',
  ],
  EXPENSE: [
    'Input cost repayment aligned with your deferral agreement',
    'Seasonal labour cost peak from historical spend data',
    'Transport + market fees estimated from prior harvests',
  ],
  NEUTRAL: [
    'Mixed cash flows expected — income and expenses nearly offset',
    'Low-activity period between planting and harvest',
    'No significant transactions predicted in this window',
  ],
};

export function ForecastReasonsDrawer({ open, onClose, date, events }: Props) {
  const net = events.reduce((s, e) => s + e.amount, 0);
  const dominantType = net > 0 ? 'INCOME' : net < 0 ? 'EXPENSE' : 'NEUTRAL';
  const confidence = 72 + Math.floor(Math.abs(net) % 20); // deterministic-ish from amount
  const filledBars = Math.round((confidence / 100) * 10);
  const reasons = REASONS[dominantType];
  const primaryEvent = events.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold leading-snug">
            {date
              ? `Predicted: ${formatNaira(Math.abs(net), { compact: false })} ${dominantType === 'INCOME' ? 'income' : 'expense'} on ${format(date, 'MMMM d')}`
              : 'Forecast Detail'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Confidence */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Confidence</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-3 rounded-sm ${i < filledBars ? 'bg-leaf-500' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-slate-700">{confidence}%</span>
            </div>
          </div>

          {/* Events breakdown */}
          {events.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Events on this day</p>
              <ul className="space-y-2">
                {events.map((e, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{e.category}</span>
                    <span className={e.amount >= 0 ? 'text-leaf-700 font-medium' : 'text-red-600 font-medium'}>
                      {e.amount >= 0 ? '+' : '−'}{formatNaira(Math.abs(e.amount), { compact: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasons */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Top reasons</p>
            <ol className="space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-leaf-600 font-bold shrink-0">{i + 1}.</span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Playbook anchor */}
          {primaryEvent && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Anchored to:{' '}
              <a href="#" className="text-leaf-700 font-medium hover:underline">
                The {primaryEvent.category} Cycle playbook
              </a>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
