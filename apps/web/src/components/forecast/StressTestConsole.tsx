import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNaira } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onRun: (scenario: string) => void;
  onReset: () => void;
  isLoading: boolean;
  activeScenario: string | null;
  result: any | null;
}

const SCENARIOS = [
  { id: 'drought',           emoji: '🌵', label: 'Drought',              desc: 'Crop yield drops 40%' },
  { id: 'price_crash',       emoji: '📉', label: 'Price crash',          desc: 'Market prices fall 30%' },
  { id: 'late_buyer',        emoji: '⏳', label: 'Late buyer',           desc: 'Payment delayed 6 weeks' },
  { id: 'late_harvest_3wk',  emoji: '🌧', label: 'Late harvest (3 wk)', desc: 'Harvest shifts 3 weeks' },
];

export function StressTestConsole({ open, onClose, onRun, onReset, isLoading, activeScenario, result }: Props) {
  const active = SCENARIOS.find((s) => s.id === activeScenario);

  // Compute impact summary from result events vs baseline
  const impactSummary = result
    ? (() => {
        const totalIncome = (result.events ?? [])
          .filter((e: any) => e.type === 'INCOME')
          .reduce((s: number, e: any) => s + Number(e.expectedAmount ?? e.amount ?? 0), 0);
        return totalIncome;
      })()
    : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Stress Test — what if conditions change?</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Scenario grid */}
          <div className="grid grid-cols-2 gap-3">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                disabled={isLoading}
                onClick={() => onRun(s.id)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50 ${
                  activeScenario === s.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                }`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-sm font-semibold text-slate-800">{s.label}</span>
                <span className="text-xs text-slate-500">{s.desc}</span>
                {activeScenario === s.id && (
                  <Badge variant="outline" className="mt-1 border-amber-400 text-amber-700 text-[10px]">Active</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && (
            <p className="text-sm text-slate-500 animate-pulse">Running simulation…</p>
          )}

          {/* Result panel */}
          {result && active && !isLoading && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-900">
                Under {active.label}:
              </p>
              <p className="text-sm text-amber-800">
                Expected income over 90 days drops to{' '}
                <span className="font-bold">{formatNaira(impactSummary ?? 0, { compact: true })}</span>.
                Cash gap risk increases — new shortfall windows may appear in amber on your calendar.
              </p>
              <p className="text-xs text-amber-700 font-medium">
                Recommended: Request an input deferral now, or sell a portion of your harvest early to cover the gap.
              </p>
            </div>
          )}

          {/* Reset */}
          {activeScenario && !isLoading && (
            <Button variant="outline" className="w-full" onClick={onReset}>
              Reset to actual forecast
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
