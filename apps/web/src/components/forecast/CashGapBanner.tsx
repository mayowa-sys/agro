import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Sprout, SlidersHorizontal, Banknote } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CashGap } from './ForecastCalendar';

interface Props {
  gaps: CashGap[];
  onRequestDeferral?: () => void;
  onAdjustSplit?: () => void;
  onRequestFactoring?: () => void;
}

const ACTIONS = [
  { Icon: Sprout,             label: 'Request input deferral',   sub: 'Buy now, repay on harvest day',      key: 'deferral' },
  { Icon: SlidersHorizontal,  label: 'Adjust split rule',        sub: 'Save more from your next payment',   key: 'split' },
  { Icon: Banknote,           label: 'Request factoring advance', sub: 'Get paid early on your harvest',     key: 'factoring' },
];

export function CashGapBanner({ gaps, onRequestDeferral, onAdjustSplit, onRequestFactoring }: Props) {
  const [open, setOpen] = useState(false);
  if (gaps.length === 0) return null;

  const worst = gaps.reduce((a, b) => (b.shortfallKobo > a.shortfallKobo ? b : a), gaps[0]);
  const handlers: Record<string, (() => void) | undefined> = {
    deferral: onRequestDeferral,
    split: onAdjustSplit,
    factoring: onRequestFactoring,
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-left hover:bg-gold-500/8 transition-colors group"
      >
        <AlertTriangle size={15} className="text-gold-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground font-sans">
            {formatNaira(worst.shortfallKobo, { compact: true })} shortfall predicted
          </span>
          <span className="text-sm text-muted-foreground font-sans ml-2">
            {format(parseISO(worst.startDate), 'MMM d')} – {format(parseISO(worst.endDate), 'MMM d')}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-sans uppercase tracking-wider group-hover:text-foreground transition-colors flex items-center gap-1">
          Take action <ArrowRight size={11} />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-card border-border p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-display text-2xl text-foreground">
              Address your gap
            </DialogTitle>
            <p className="text-sm text-muted-foreground font-sans mt-1">
              {formatNaira(worst.shortfallKobo)} short ·{' '}
              {format(parseISO(worst.startDate), 'MMM d')}–{format(parseISO(worst.endDate), 'MMM d')}
            </p>
          </DialogHeader>
          <div className="px-4 py-4 space-y-2">
            {ACTIONS.map(({ Icon, label, sub, key }) => (
              <button
                key={key}
                onClick={() => { setOpen(false); handlers[key]?.(); }}
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-background hover:bg-accent px-4 py-3 text-left transition-all group"
              >
                <Icon size={15} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground font-sans">{label}</p>
                  <p className="text-xs text-muted-foreground font-sans">{sub}</p>
                </div>
                <ArrowRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
