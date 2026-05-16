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
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useForecast } from '@/hooks/useForecast';

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
  LineChart,
  Line,
  ReferenceDot,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

// ─── Pot-trajectory simulation ────────────────────────────────────────────────
// Walks Tunde's three pots day-by-day for 90 days, applying real forecast
// events under the current slider rule. Mirrors the backend advisor's
// `simulate()` function in apps/api/src/services/splits.advisor.ts.

interface ForecastEventLite {
  date: string;
  type: 'INCOME' | 'EXPENSE' | 'NEUTRAL';
  amount: number; // kobo
  category: string;
}

interface StartingBalances {
  workingKobo: number;
  billsKobo: number;
  nextSeasonKobo: number;
}

const CATEGORY_TO_POT: Record<string, 'WORKING' | 'BILLS' | 'NEXT_SEASON'> = {
  HOUSEHOLD: 'BILLS',
  SCHOOL_FEES: 'BILLS',
  UTILITIES: 'BILLS',
  MEDICAL: 'BILLS',
  INPUTS: 'NEXT_SEASON',
  NEXT_SEASON: 'NEXT_SEASON',
  LABOUR: 'WORKING',
  TRANSPORT: 'WORKING',
};

function categoryToPot(category: string): 'WORKING' | 'BILLS' | 'NEXT_SEASON' {
  return CATEGORY_TO_POT[category] ?? 'WORKING';
}

function simulateThreePots(
  sliders: Sliders,
  balances: StartingBalances,
  events: ForecastEventLite[],
  horizonDays = 90,
) {
  // Bucket events by day-offset from today (0..horizonDays)
  const now = new Date();
  const byDay = new Map<number, ForecastEventLite[]>();
  for (const ev of events) {
    const d = new Date(ev.date);
    const diff = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
    if (diff < 0 || diff > horizonDays) continue;
    if (!byDay.has(diff)) byDay.set(diff, []);
    byDay.get(diff)!.push(ev);
  }

  let working = balances.workingKobo;
  let bills = balances.billsKobo;
  let nextSeason = balances.nextSeasonKobo;
  const data: Array<{ day: number; working: number; bills: number; nextSeason: number; eventLabel?: string; eventType?: 'INCOME' | 'EXPENSE' }> = [];

  for (let d = 0; d <= horizonDays; d++) {
    const dayEvents = byDay.get(d) ?? [];
    let topEvent: { label: string; type: 'INCOME' | 'EXPENSE' } | null = null;
    let topAmount = 0;

    for (const ev of dayEvents) {
      const amt = ev.amount;
      if (ev.type === 'INCOME') {
        const wShare = Math.round((amt * sliders.workingCapital) / 100);
        const bShare = Math.round((amt * sliders.bills) / 100);
        const nShare = amt - wShare - bShare;
        working += wShare;
        bills += bShare;
        nextSeason += nShare;
        if (amt > topAmount) {
          topAmount = amt;
          topEvent = { label: ev.category.replace('_', ' '), type: 'INCOME' };
        }
      } else if (ev.type === 'EXPENSE') {
        const pot = categoryToPot(ev.category);
        if (pot === 'WORKING') working -= amt;
        else if (pot === 'BILLS') bills -= amt;
        else nextSeason -= amt;
        if (amt > topAmount) {
          topAmount = amt;
          topEvent = { label: ev.category.replace('_', ' '), type: 'EXPENSE' };
        }
      }
    }

    data.push({
      day: d,
      working,
      bills,
      nextSeason,
      eventLabel: topEvent?.label,
      eventType: topEvent?.type,
    });
  }

  return data;
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

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  const dayNum = datum?.day ?? 0;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-md min-w-[160px]"
      style={{
        backgroundColor: 'hsl(var(--popover))',
        borderColor: 'hsl(var(--border))',
      }}
    >
      <p className="font-semibold mb-1.5">Day {dayNum}</p>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.stroke }} />
              <span className="text-muted-foreground capitalize">
                {p.dataKey === 'nextSeason' ? 'Next Season' : p.dataKey}
              </span>
            </span>
            <span className="tabular-nums font-medium" style={{ color: p.value < 0 ? '#dc2626' : 'inherit' }}>
              {formatNaira(p.value, { compact: true })}
            </span>
          </div>
        ))}
      </div>
      {datum?.eventLabel && (
        <p
          className="mt-2 pt-2 border-t text-[10px] uppercase tracking-wide"
          style={{
            borderColor: 'hsl(var(--border))',
            color: datum.eventType === 'INCOME' ? '#15803d' : '#9a3412',
          }}
        >
          {datum.eventType === 'INCOME' ? '↑' : '↓'} {datum.eventLabel}
        </p>
      )}
    </div>
  );
}

// ─── Last applied callout ────────────────────────────────────────────────────
// Reads the projection endpoint (which already contains real history) and
// renders proof that the rule has actually fired on a real harvest event.
// Renders nothing if no harvest history exists.

type HistoryEntry = {
  date: string;
  type: 'HARVEST_PAYMENT' | 'WAGE_PAID';
  amountKobo: number;
  narrative: string;
  liberationKobo: number;
};

function formatRelativeDate(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - target.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  return target.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' });
}

function LastAppliedCallout() {
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [split, setSplit] = useState<{ workingPct: number; billsPct: number; nextSeasonPct: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/demo/replay/projection').then((res) => {
      if (cancelled) return;
      const history: HistoryEntry[] = res.data?.history ?? [];
      const lastHarvest = [...history]
        .filter((h) => h.type === 'HARVEST_PAYMENT')
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (lastHarvest) setEntry(lastHarvest);
      const facts = res.data?.facts;
      if (facts?.splitRule) setSplit(facts.splitRule);
    }).catch(() => {
      // silent fail — callout just doesn't render
    });
    return () => { cancelled = true; };
  }, []);

  if (!entry || !split) return null;

  const workingKobo = Math.floor((entry.amountKobo * split.workingPct) / 100);
  const billsKobo = Math.floor((entry.amountKobo * split.billsPct) / 100);
  const nextSeasonKobo = Math.floor((entry.amountKobo * split.nextSeasonPct) / 100);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'hsl(var(--leaf-500, 142 71% 45%) / 0.06)',
        border: '1px solid hsl(var(--leaf-500, 142 71% 45%) / 0.25)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-leaf-500 flex-shrink-0" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-leaf-500">
            Last applied · {formatRelativeDate(entry.date)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatNaira(entry.amountKobo, { compact: true })} routed via Squad
        </p>
      </div>
      <p className="text-sm text-foreground mb-3">{entry.narrative}</p>
      {/* Mini stacked bar showing how this sale was routed */}
      <div className="flex h-2 w-full rounded-full overflow-hidden gap-px mb-2">
        <div className="bg-leaf-500" style={{ width: `${split.workingPct}%` }} />
        <div className="bg-amber-400" style={{ width: `${split.billsPct}%` }} />
        <div className="bg-sky-400" style={{ width: `${split.nextSeasonPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">{split.workingPct}%</span> Working ·{' '}
          <span className="tabular-nums">{formatNaira(workingKobo, { compact: true })}</span>
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">{split.billsPct}%</span> Bills ·{' '}
          <span className="tabular-nums">{formatNaira(billsKobo, { compact: true })}</span>
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">{split.nextSeasonPct}%</span> Next Season ·{' '}
          <span className="tabular-nums">{formatNaira(nextSeasonKobo, { compact: true })}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SplitRules() {
  const navigate = useNavigate();
  const [showSimulation, setShowSimulation] = useState(false);
  const { data: rule, isLoading: ruleLoading } = useSplitRule();
  const {
    data: suggestion,
    isLoading: sugLoading,
    refetch: refetchSug,
  } = useSplitSuggestion();
  const save = useSaveSplitRule();

  const handleRequestCredit = () => {
    if (suggestion?.drivingEvent) {
      // Pre-fill credit dialog with the driving event amount
      const amountNaira = Math.round(Number(suggestion.drivingEvent.amountKobo) / 100);
      navigate(`/farmer/deferrals?prefill=${amountNaira}&category=${suggestion.drivingEvent.category}`);
    } else {
      navigate('/farmer/deferrals');
    }
  };

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

  // Live forecast events + current pot balances power the trajectory chart
  const { data: forecast } = useForecast();
  const { data: dashboardData } = useQuery<any>({
    queryKey: ['accounts', 'dashboard'],
    queryFn: () => api.get('/accounts/dashboard').then(r => r.data),
  });

  const startingBalances = React.useMemo<StartingBalances>(() => {
    const accounts = dashboardData?.accounts ?? [];
    const find = (purpose: string) =>
      Number(accounts.find((a: any) => a.purpose === purpose)?.balanceKobo ?? 0);
    return {
      workingKobo: find('WORKING'),
      billsKobo: find('BILLS'),
      nextSeasonKobo: find('NEXT_SEASON'),
    };
  }, [dashboardData]);

  const trajectoryData = React.useMemo(() => {
    if (!forecast?.events) return [];
    return simulateThreePots(sliders, startingBalances, forecast.events as ForecastEventLite[], 90);
  }, [sliders, startingBalances, forecast?.events]);
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

      {/* Last applied — proof this rule fires on real harvest events */}
      <LastAppliedCallout />

      {/* §1 — Current rule visualizer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Current allocation</CardTitle>
          <p className="text-xs text-muted-foreground">
            How your harvest is divided right now. Move the sliders below to adjust.
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
              <p className="text-sm text-foreground leading-relaxed">
                {suggestion.explanation}
              </p>
              {/* Status badge row */}
              {suggestion.status && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      background:
                        suggestion.status === 'OPTIMAL' ? 'rgba(34,197,94,0.15)' :
                        suggestion.status === 'ADJUST' ? 'rgba(245,158,11,0.15)' :
                        suggestion.status === 'CREDIT_NEEDED' ? 'rgba(217,119,6,0.18)' :
                        'rgba(148,163,184,0.18)',
                      color:
                        suggestion.status === 'OPTIMAL' ? '#15803d' :
                        suggestion.status === 'ADJUST' ? '#92400e' :
                        suggestion.status === 'CREDIT_NEEDED' ? '#9a3412' :
                        '#475569',
                    }}
                  >
                    {suggestion.status === 'OPTIMAL' ? 'Split is optimal' :
                     suggestion.status === 'ADJUST' ? 'Adjustment recommended' :
                     suggestion.status === 'CREDIT_NEEDED' ? 'Splits can\'t bridge timing' :
                     'No data'}
                  </span>
                  {suggestion.simulation && (
                    <span className="text-[10px] text-muted-foreground">
                      {suggestion.simulation.candidatesEvaluated} candidates · {suggestion.simulation.horizonDays} day horizon
                    </span>
                  )}
                </div>
              )}

              {/* Driving event callout — CREDIT_NEEDED case */}
              {suggestion.status === 'CREDIT_NEEDED' && suggestion.drivingEvent && (
                <div
                  className="rounded-lg border p-3 space-y-2.5"
                  style={{
                    borderColor: 'rgba(217,119,6,0.35)',
                    background: 'rgba(217,119,6,0.06)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#9a3412' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#9a3412' }}>
                        Upcoming shortfall
                      </p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {(() => {
                          const e = suggestion.drivingEvent;
                          const naira = Number(e.amountKobo) / 100;
                          const cat = e.category.toLowerCase().replace('_', ' ');
                          const date = new Date(e.expectedDate).toLocaleDateString('en-NG', {
                            month: 'short',
                            day: 'numeric',
                          });
                          return `₦${naira.toLocaleString('en-NG')} ${cat} expected ${date}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRequestCredit}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  >
                    Request input credit
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Simulation details — collapsible */}
              {suggestion.simulation?.currentRule && (
                <details
                  open={showSimulation}
                  onToggle={(e) => setShowSimulation((e.target as HTMLDetailsElement).open)}
                  className="rounded-md border border-border bg-muted/20"
                >
                  <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSimulation ? 'rotate-0' : '-rotate-90'}`} />
                    {showSimulation ? 'Hide' : 'Show'} per-pot simulation
                  </summary>
                  <div className="px-3 pb-3 grid grid-cols-3 gap-3">
                    {suggestion.simulation.currentRule.map((p) => {
                      const formatK = (kobo: string) => {
                        const n = Number(kobo) / 100;
                        if (Math.abs(n) >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'M';
                        if (Math.abs(n) >= 1_000) return '₦' + Math.round(n / 1_000) + 'k';
                        return '₦' + n.toFixed(0);
                      };
                      const label =
                        p.pot === 'WORKING' ? 'Working' :
                        p.pot === 'BILLS' ? 'Bills' :
                        'Next Season';
                      const shortfall = Number(p.shortfallKobo) > 0;
                      return (
                        <div key={p.pot} className="text-[10px] leading-tight space-y-0.5">
                          <div className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                          <div className="text-foreground tabular-nums">
                            <span className="text-leaf-500">+{formatK(p.inflowKobo)}</span>
                            <span className="text-muted-foreground"> · </span>
                            <span className="text-clay-500">−{formatK(p.outflowKobo)}</span>
                          </div>
                          <div className={shortfall ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                            ends {formatK(p.endKobo)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
              {suggestion.status === 'ADJUST' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-leaf-500/40 hover:bg-leaf-500/10 hover:border-leaf-500"
                  onClick={applySuggestion}
                >
                  Apply suggestion
                </Button>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Could not load suggestion. Try refreshing.
            </p>
          )}
        </CardContent>
      </Card>

      {/* §4 — Pot trajectory · live 90-day simulation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Pot trajectory · next 90 days</CardTitle>
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
            How your three Squad pots evolve under your current split — live forecast, updates with the sliders.
          </p>
        </CardHeader>
        <CardContent>
          {trajectoryData.length === 0 ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trajectoryData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  interval={14}
                  tickFormatter={(v) => `D${v}`}
                />
                <YAxis
                  tickFormatter={(v) => formatNaira(v, { compact: true })}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
                  formatter={(value) => value === 'nextSeason' ? 'Next Season' : value.charAt(0).toUpperCase() + value.slice(1)}
                />
                <Line
                  type="monotone"
                  dataKey="working"
                  name="working"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={200}
                />
                <Line
                  type="monotone"
                  dataKey="bills"
                  name="bills"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={200}
                />
                <Line
                  type="monotone"
                  dataKey="nextSeason"
                  name="nextSeason"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={200}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <GraphInfoDialog
          open={whatIfInfoOpen}
          onClose={() => setWhatIfInfoOpen(false)}
          title="Pot trajectory"
      >
        <p>
          Three lines, one per Squad pot, projected over the next <strong className="text-foreground">90 days</strong>. Each line starts at your current pot balance and walks forward through every event Prophet has forecast — harvest income, fertilizer, labour, school fees.
        </p>
        <p>
          <strong className="text-foreground">Income events</strong> are split across the three pots using your current slider rule. <strong className="text-foreground">Expense events</strong> draw down whichever pot covers that category — household goes to Bills, inputs to Next Season, labour to Working.
        </p>
        <p>
          <strong className="text-foreground">Move the sliders</strong> and watch all three lines redraw. The math is the same simulation AGRO's advisor runs server-side — run live in your browser.
        </p>
        <p className="text-xs border-t pt-3" style={{ borderColor: 'hsl(var(--border))' }}>
          A line going below zero means that pot would overdraw — a sign your split needs adjusting, or that input credit is the better bridge.
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
