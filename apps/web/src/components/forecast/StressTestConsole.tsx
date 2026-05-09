import { X, Droplets, TrendingDown, Clock, CloudRain, RotateCcw, Loader2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatNaira } from '@/lib/format';
import { cn } from '@/lib/cn';

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
  { id: 'drought',          Icon: Droplets,    label: 'Drought',        desc: 'Crop yield drops 40%' },
  { id: 'price_crash',      Icon: TrendingDown, label: 'Price crash',    desc: 'Market prices fall 30%' },
  { id: 'late_buyer',       Icon: Clock,        label: 'Late buyer',     desc: 'Payment delayed 6 weeks' },
  { id: 'late_harvest_3wk', Icon: CloudRain,    label: 'Late harvest',   desc: 'Harvest shifts 3 weeks' },
];

export function StressTestConsole({ open, onClose, onRun, onReset, isLoading, activeScenario, result }: Props) {
  const active = SCENARIOS.find((s) => s.id === activeScenario);

  const impactIncome = result
    ? (result.events ?? [])
        .filter((e: any) => e.type === 'INCOME')
        .reduce((s: number, e: any) => s + Number(e.expectedAmount ?? e.amount ?? 0), 0)
    : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm bg-card border-l border-border p-0 flex flex-col"
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-5 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-1">Simulation</p>
            <h2 className="font-display text-2xl text-foreground leading-tight">Stress Test</h2>
            <p className="text-sm text-muted-foreground font-sans mt-0.5">What if conditions change?</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors mt-1 p-1 rounded hover:bg-accent"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Scenarios */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-3">Choose a scenario</p>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map(({ id, Icon, label, desc }) => {
                const isActive = activeScenario === id;
                return (
                  <button
                    key={id}
                    disabled={isLoading}
                    onClick={() => onRun(id)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left transition-all duration-150 disabled:opacity-40',
                      isActive
                        ? 'border-gold-500/50 bg-gold-500/5'
                        : 'border-border bg-background hover:border-border hover:bg-accent cursor-pointer'
                    )}
                  >
                    <Icon
                      size={16}
                      className={isActive ? 'text-gold-500' : 'text-muted-foreground'}
                    />
                    <div>
                      <p className={cn('text-sm font-semibold font-sans leading-tight', isActive ? 'text-foreground' : 'text-foreground')}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground font-sans mt-0.5">{desc}</p>
                    </div>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wider text-gold-500 font-sans font-semibold">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2.5 py-1">
              <Loader2 size={14} className="text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground font-sans">Running simulation…</p>
            </div>
          )}

          {/* Result */}
          {result && active && !isLoading && (
            <div className="rounded-lg border border-gold-500/25 bg-gold-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <active.Icon size={14} className="text-gold-500" />
                <p className="text-xs font-semibold text-foreground font-sans uppercase tracking-wide">
                  {active.label} scenario
                </p>
              </div>
              {impactIncome !== null && (
                <div>
                  <p className="text-xs text-muted-foreground font-sans uppercase tracking-widest mb-0.5">Expected 90-day income</p>
                  <p className="font-display text-2xl text-foreground">
                    {formatNaira(impactIncome, { compact: true })}
                  </p>
                </div>
              )}
              <p className="text-sm text-foreground/80 font-sans leading-relaxed">
                Cash gap risk is elevated. New shortfall windows may appear on your calendar.
              </p>
              <p className="text-xs text-muted-foreground font-sans">
                Recommended: request an input deferral or sell a portion of your harvest early.
              </p>
            </div>
          )}

          {/* Reset */}
          {activeScenario && !isLoading && (
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background hover:bg-accent py-2.5 text-sm text-foreground font-sans transition-all"
            >
              <RotateCcw size={13} />
              Reset to actual forecast
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
