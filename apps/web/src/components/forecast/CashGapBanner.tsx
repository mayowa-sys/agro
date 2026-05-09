import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CashGap } from './ForecastCalendar';

interface Props {
  gaps: CashGap[];
  onRequestDeferral?: () => void;
  onAdjustSplit?: () => void;
  onRequestFactoring?: () => void;
}

export function CashGapBanner({ gaps, onRequestDeferral, onAdjustSplit, onRequestFactoring }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (gaps.length === 0) return null;

  const worst = gaps.reduce((a, b) => (b.shortfallKobo > a.shortfallKobo ? b : a), gaps[0]);

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="flex-1 text-sm text-amber-800">
          <span className="font-semibold">Predicted short period: </span>
          {formatNaira(worst.shortfallKobo, { compact: true })} short between{' '}
          {format(parseISO(worst.startDate), 'MMM d')} and {format(parseISO(worst.endDate), 'MMM d')}.{' '}
          <button
            className="font-semibold underline underline-offset-2 hover:text-amber-900"
            onClick={() => setDialogOpen(true)}
          >
            Take action
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Address your cash gap</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mb-4">
            You're predicted to be {formatNaira(worst.shortfallKobo)} short between{' '}
            {format(parseISO(worst.startDate), 'MMM d')} and {format(parseISO(worst.endDate), 'MMM d')}.
            Choose an action:
          </p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => { setDialogOpen(false); onRequestDeferral?.(); }}
            >
              🌱 Request input deferral
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => { setDialogOpen(false); onAdjustSplit?.(); }}
            >
              ⚖️ Adjust my split rule
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => { setDialogOpen(false); onRequestFactoring?.(); }}
            >
              💰 Request factoring advance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
