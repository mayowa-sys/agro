import { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  Sprout,
  Wallet,
  CalendarDays,
  Sparkles,
  Save,
  RefreshCw,
  Info,
} from 'lucide-react';

import { toast } from 'sonner';
import {
  useSplitRule,
  useSplitSuggestion,
  useSaveSplitRule,
  useLinkedSliders,
  type BucketKey,
  type Sliders,
} from '@/hooks/useSplitRules';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatNaira } from '@/lib/format';
import React from 'react';

// ─── Graph info dialog ────────────────────────────────────────────────────────

function GraphInfoDialog({
                           open,
                           onClose,
                           title,
                           children,
                         }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Lock body scroll when open
  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
      <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
      >
        <div
            className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
            onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              style={{ backgroundColor: 'hsl(var(--muted))' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Icon accent */}
          <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'hsl(var(--leaf-500, 142 71% 45%) / 0.12)' }}
          >
            <Info className="w-5 h-5 text-leaf-500" />
          </div>

          {/* Title */}
          <h2
              className="text-xl font-bold mb-1 tracking-tight"
              style={{ fontFamily: '"DM Serif Display", serif' }}
          >
            {title}
          </h2>

          {/* Hairline */}
          <div className="h-px w-12 mb-4 bg-leaf-500 rounded-full" />

          {/* Content */}
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
  );
}

// ─── Custom slider ────────────────────────────────────────────────────────────

function BucketSlider({
                        value,
                        color,
                        onChange,
                      }: {
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number>(0);
  const isDragging = React.useRef(false);

  // Keep DOM in sync with value prop without React re-render during drag
  const applyValue = React.useCallback((pct: number) => {
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
  }, []);

  // Sync from prop when not dragging
  React.useEffect(() => {
    if (!isDragging.current) applyValue(value);
  }, [value, applyValue]);

  const getPercent = React.useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, raw));
  }, []);

  const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        isDragging.current = true;
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);

        const move = (ev: PointerEvent) => {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            const pct = getPercent(ev.clientX);
            applyValue(pct);
            onChange(Math.round(pct));
          });
        };

        const up = (ev: PointerEvent) => {
          cancelAnimationFrame(rafRef.current);
          isDragging.current = false;
          const pct = getPercent(ev.clientX);
          applyValue(Math.round(pct));
          onChange(Math.round(pct));
          target.removeEventListener('pointermove', move);
          target.removeEventListener('pointerup', up);
          target.removeEventListener('pointercancel', up);
        };

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);

        // Handle initial click position too
        const pct = getPercent(e.clientX);
        applyValue(pct);
        onChange(Math.round(pct));
      },
      [applyValue, getPercent, onChange]
  );

  const handleKey = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const steps: Record<string, number> = {
          ArrowLeft: -1,
          ArrowDown: -1,
          ArrowRight: 1,
          ArrowUp: 1,
          PageDown: -10,
          PageUp: 10,
        };
        if (e.key === 'Home') { e.preventDefault(); onChange(0); return; }
        if (e.key === 'End')  { e.preventDefault(); onChange(100); return; }
        if (steps[e.key] !== undefined) {
          e.preventDefault();
          onChange(Math.max(0, Math.min(100, value + steps[e.key])));
        }
      },
      [value, onChange]
  );

  return (
      <div
          ref={trackRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKey}
          className="relative h-3 w-full rounded-full cursor-pointer touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background group"
          style={{ backgroundColor: 'hsl(var(--muted))' }}
      >
        {/* Fill — no CSS transition, DOM-driven for zero lag */}
        <div
            ref={fillRef}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${value}%`,
              backgroundColor: color,
              willChange: 'width',
            }}
        />
        {/* Thumb */}
        <div
            ref={thumbRef}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background border-2 shadow-md transition-transform duration-100 group-hover:scale-110 group-active:scale-95"
            style={{
              left: `${value}%`,
              borderColor: color,
              willChange: 'left',
            }}
        >
          <div
              className="absolute inset-1.5 rounded-full"
              style={{ backgroundColor: color }}
          />
        </div>
      </div>
  );
}
// ─── Bucket config ────────────────────────────────────────────────────────────

const BUCKETS: {
  key: BucketKey;
  label: string;
  sublabel: string;
  icon: typeof Sprout;
  bgClass: string;
  hex: string;
}[] = [
  {
    key: 'workingCapital',
    label: 'Working Capital',
    sublabel: 'Day-to-day farm operations',
    icon: Sprout,
    bgClass: 'bg-leaf-500',
    hex: '#22c55e',
  },
  {
    key: 'bills',
    label: 'Bills & Essentials',
    sublabel: 'Rent, school fees, household',
    icon: Wallet,
    bgClass: 'bg-amber-400',
    hex: '#fbbf24',
  },
  {
    key: 'nextSeason',
    label: 'Next Season',
    sublabel: 'Seeds, inputs, savings buffer',
    icon: CalendarDays,
    bgClass: 'bg-sky-400',
    hex: '#38bdf8',
  },
];

// ─── What-if preview data ─────────────────────────────────────────────────────
// Pure client-side projection — no API call. Distributes a ₦220k harvest
// across 30 days using current slider proportions.

function buildWhatIfData(sliders: Sliders) {
  const harvest = 220_000; // naira
  const bills = (harvest * sliders.bills) / 100;
  const ns = (harvest * sliders.nextSeason) / 100;

  let cum = 0;
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const income = day === 9 ? harvest : 0;
    const billsOut = day >= 9 && day < 23 ? bills / 14 : 0;
    const nsLocked = day === 9 ? ns : 0;
    cum += income - billsOut - nsLocked;
    return { day: `D${day}`, cumulative: Math.round(cum) };
  });
}

// ─── Stacked bar ─────────────────────────────────────────────────────────────

function StackedBar({ sliders }: { sliders: Sliders }) {
  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full rounded-lg overflow-hidden gap-px">
        {BUCKETS.map((b) => (
          <div
            key={b.key}
            className={`${b.bgClass} transition-all duration-300 flex items-center justify-center`}
            style={{ width: `${sliders[b.key]}%` }}
          >
            {sliders[b.key] >= 12 && (
              <span className="text-white text-[11px] font-bold tabular-nums drop-shadow-sm">
                {sliders[b.key]}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {BUCKETS.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${b.bgClass} flex-shrink-0`} />
            <span className="text-xs text-muted-foreground">{b.label}</span>
            <span className="text-xs font-semibold tabular-nums">{sliders[b.key]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-md"
      style={{
        backgroundColor: 'hsl(var(--popover))',
        borderColor: 'hsl(var(--border))',
      }}
    >
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: '#22c55e' }}>
        Cumulative: {formatNaira(Math.round(val * 100), { compact: true })}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SplitRules() {
  const { data: rule, isLoading: ruleLoading } = useSplitRule();
  const {
    data: suggestion,
    isLoading: sugLoading,
    refetch: refetchSug,
  } = useSplitSuggestion();
  const save = useSaveSplitRule();

  const { sliders, move, reset } = useLinkedSliders({
    workingCapital: 60,
    bills: 25,
    nextSeason: 15,
  });

  const [dirty, setDirty] = useState(false);
  const [original, setOriginal] = useState<Sliders | null>(null);

  // Sync from API on load
  useEffect(() => {
    if (!rule) return;
    const s: Sliders = {
      workingCapital: rule.workingCapitalPct,
      bills: rule.billsPct,
      nextSeason: rule.nextSeasonPct,
    };
    reset(s);
    setOriginal(s);
    setDirty(false);
  }, [rule, reset]);

  // Track dirtiness
  useEffect(() => {
    if (!original) return;
    setDirty(
      sliders.workingCapital !== original.workingCapital ||
        sliders.bills !== original.bills ||
        sliders.nextSeason !== original.nextSeason
    );
  }, [sliders, original]);

  const applySuggestion = () => {
    if (!suggestion) return;
    reset({
      workingCapital: suggestion.workingCapitalPct,
      bills: suggestion.billsPct,
      nextSeason: suggestion.nextSeasonPct,
    });
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        workingCapitalPct: sliders.workingCapital,
        billsPct: sliders.bills,
        nextSeasonPct: sliders.nextSeason,
      });
      setOriginal({ ...sliders });
      setDirty(false);
      toast.success('Split rule saved');
    } catch {
      toast.error('Failed to save. Try again.');
    }
  };

  const whatIfData = buildWhatIfData(sliders);
  const [whatIfInfoOpen, setWhatIfInfoOpen] = useState(false);

  if (ruleLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: '"DM Serif Display", serif' }}
        >
          Split Rules
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How your harvest payment is divided across three buckets.
        </p>
      </div>

      {/* §1 — Current rule visualizer */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">What-if preview</CardTitle>
            <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-muted-foreground hover:text-foreground"
                onClick={() => setWhatIfInfoOpen(true)}
            >
              <Info className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Simulated 30-day cash position after a ₦220k harvest, using your current sliders.
          </p>
        </CardHeader>
        <CardContent>
          <StackedBar sliders={sliders} />
        </CardContent>
      </Card>

      {/* §2 — Sliders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Adjust your split</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {BUCKETS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium leading-none">{b.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.sublabel}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="tabular-nums font-bold text-sm px-2.5">
                    {sliders[b.key]}%
                  </Badge>
                </div>
                <BucketSlider
                    value={sliders[b.key]}
                    color={b.hex}
                    onChange={(v) => move(b.key, v)}
                />
              </div>
            );
          })}
          <Separator />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total allocated</span>
            <span
              className={`font-bold tabular-nums ${
                sliders.workingCapital + sliders.bills + sliders.nextSeason === 100
                  ? 'text-leaf-500'
                  : 'text-destructive'
              }`}
            >
              {sliders.workingCapital + sliders.bills + sliders.nextSeason}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* §3 — AI suggestion */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-leaf-500" />
              Suggested by Agro
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={() => refetchSug()}
              disabled={sugLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sugLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sugLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : suggestion ? (
            <>
              <div className="flex h-4 w-full rounded overflow-hidden gap-px">
                <div className="bg-leaf-500" style={{ width: `${suggestion.workingCapitalPct}%` }} />
                <div className="bg-amber-400" style={{ width: `${suggestion.billsPct}%` }} />
                <div className="bg-sky-400" style={{ width: `${suggestion.nextSeasonPct}%` }} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{suggestion.workingCapitalPct}%</span> Working
                </span>
                <span>
                  <span className="font-semibold text-foreground">{suggestion.billsPct}%</span> Bills
                </span>
                <span>
                  <span className="font-semibold text-foreground">{suggestion.nextSeasonPct}%</span> Next Season
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                "{suggestion.explanation}"
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-leaf-500/40 hover:bg-leaf-500/10 hover:border-leaf-500"
                onClick={applySuggestion}
              >
                Apply suggestion
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Could not load suggestion. Try refreshing.
            </p>
          )}
        </CardContent>
      </Card>

      {/* §4 — What-if preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">What-if preview</CardTitle>
          <p className="text-xs text-muted-foreground">
            Simulated 30-day cash position after a ₦220k harvest using your current sliders.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={whatIfData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={4}
                tickFormatter={(v: string) => {
                  const n = parseInt(v.replace('D', ''));
                  return `Day ${n}`;
                }}
              />
              <YAxis
                tickFormatter={(v) => formatNaira(v * 100, { compact: true })}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#cumGrad)"
                dot={false}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <GraphInfoDialog
          open={whatIfInfoOpen}
          onClose={() => setWhatIfInfoOpen(false)}
          title="What-if preview"
      >
        <p>
          This chart simulates your cash position over 30 days assuming a <strong className="text-foreground">₦220,000 harvest payment</strong> arrives on Day 9.
        </p>
        <p>
          The line shows your <strong className="text-foreground">cumulative liquid cash</strong> — money in your pocket after your split rule has been applied. Bills are paid out gradually over the two weeks following harvest. Your Next Season allocation is locked away immediately on harvest day.
        </p>
        <p>
          <strong className="text-foreground">Move the sliders</strong> and watch the chart update in real time — a higher Working Capital % keeps more cash liquid day-to-day, while a higher Next Season % builds your planting buffer faster.
        </p>
        <p className="text-xs border-t pt-3" style={{ borderColor: 'hsl(var(--border))' }}>
          This is a projection only. Your actual harvest amount and timing will affect the real outcome.
        </p>
      </GraphInfoDialog>

      {/* §5 — Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-6 pointer-events-none">
        <div
          className="pointer-events-auto rounded-xl border shadow-lg px-6 py-3 flex items-center gap-4 transition-all duration-200"
          style={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: dirty ? 'hsl(var(--border))' : 'hsl(var(--border))',
            opacity: dirty ? 1 : 0.4,
            transform: dirty ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          {dirty && (
            <p className="text-xs text-muted-foreground">Unsaved changes</p>
          )}
          <Button
            disabled={!dirty || save.isPending}
            onClick={handleSave}
            size="sm"
            className="bg-leaf-600 hover:bg-leaf-700 text-white gap-2"
          >
            {save.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
