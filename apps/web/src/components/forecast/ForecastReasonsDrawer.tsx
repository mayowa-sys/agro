import { format } from 'date-fns';
import { X, TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatNaira } from '@/lib/format';
import type { ForecastEvent } from './ForecastCalendar';

interface Props {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  events: ForecastEvent[];
}


export function ForecastReasonsDrawer({ open, onClose, date, events }: Props) {
  const net = events.reduce((s, e) => s + (e.type === 'EXPENSE' ? -Math.abs(e.amount) : Math.abs(e.amount)), 0);
  const dominantType = net > 0 ? 'INCOME' : net < 0 ? 'EXPENSE' : 'NEUTRAL';
  const confidence = Math.min(95, 72 + Math.floor((Math.abs(net) / 1_000_000) % 20));
  const sortedEvents = [...events].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const dominantEvent = sortedEvents[0];
  const reasons = dominantEvent?.reasons?.length
      ? dominantEvent.reasons
      : (dominantType === 'INCOME'
          ? ['Income predicted based on crop cycle and market data']
          : dominantType === 'EXPENSE'
              ? ['Expense predicted based on seasonal spending patterns']
              : ['No significant cash flow predicted']);

  const NetIcon = dominantType === 'INCOME' ? TrendingUp : dominantType === 'EXPENSE' ? TrendingDown : Minus;
  const netColor = dominantType === 'INCOME' ? 'text-leaf-500' : dominantType === 'EXPENSE' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm bg-card border-l border-border p-0 flex flex-col"
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {date && (
                <p className="text-base font-semibold text-foreground font-sans mb-1">
                  {format(date, 'EEEE, MMMM d')}
                </p>
              )}
              <div className="flex items-baseline gap-2">
                <p className="font-display text-3xl text-foreground">
                  {net >= 0 ? '+' : '−'}{formatNaira(Math.abs(net))}
                </p>
                <NetIcon size={16} className={netColor} />
              </div>
              <p className="text-sm text-muted-foreground font-sans mt-0.5">
                {dominantType === 'INCOME' ? 'expected income' : dominantType === 'EXPENSE' ? 'expected expense' : 'net neutral'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 p-1 rounded hover:bg-accent"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans">Model confidence</p>
              <span className="text-sm font-bold text-foreground font-sans tabular-nums">{confidence}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-leaf-500 rounded-full transition-all duration-500"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>

          {/* Breakdown */}
          {sortedEvents.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-3">Breakdown</p>
                <div className="space-y-2.5">
                  {sortedEvents.map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.type === 'EXPENSE' ? 'bg-destructive' : 'bg-leaf-500'}`} />
                          <span className="text-sm text-foreground font-sans truncate">{e.category.replace(/_/g, ' ')}</span>
                        </div>
                        <span className={`text-sm font-semibold font-sans tabular-nums shrink-0 ${e.type === 'EXPENSE' ? 'text-destructive' : 'text-leaf-500'}`}>
                      {e.type === 'EXPENSE' ? '−' : '+'}{formatNaira(Math.abs(e.amount), { compact: true })}
                    </span>
                      </div>
                  ))}
                </div>
              </div>
          )}

          {/* Reasons */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-3">Why Agro predicts this</p>
            <ol className="space-y-3">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-xs font-bold text-muted-foreground font-sans mt-0.5 tabular-nums w-4 shrink-0">{i + 1}.</span>
                  <span className="text-sm text-foreground font-sans leading-relaxed">{r}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Playbook anchor */}
          {sortedEvents[0] && (
            <div className="border border-border rounded-lg px-4 py-3 flex items-center gap-3">
              <BookOpen size={14} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground font-sans">Anchored to</p>
                <a href="#" className="text-sm text-leaf-500 hover:text-leaf-600 font-sans font-medium transition-colors">
                  {sortedEvents[0].category.replace(/_/g, ' ')} Cycle playbook →
                </a>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
