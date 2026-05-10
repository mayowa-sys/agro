import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ArrowRight, Sprout, SlidersHorizontal, Banknote, X } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import type { CashGap } from './ForecastCalendar';

interface Props {
  gaps: CashGap[];
  onRequestDeferral?: () => void;
  onAdjustSplit?: () => void;
  onRequestFactoring?: () => void;
}

const ACTIONS = [
  { Icon: Sprout,             label: 'Request input credit',     sub: 'Buy now, repay on harvest day',      key: 'deferral' },
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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
          >
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
              <div>
                <h2 className="font-display text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                  Address your gap
                </h2>
                <p className="text-sm font-sans mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {formatNaira(worst.shortfallKobo)} short ·{' '}
                  {format(parseISO(worst.startDate), 'MMM d')}–{format(parseISO(worst.endDate), 'MMM d')}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-accent"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-2">
              {ACTIONS.map(({ Icon, label, sub, key }) => (
                <button
                  key={key}
                  onClick={() => { setOpen(false); handlers[key]?.(); }}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all group"
                  style={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  <Icon size={15} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium font-sans" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
                    <p className="text-xs font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>{sub}</p>
                  </div>
                  <ArrowRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
