import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShieldCheck, ChevronRight } from 'lucide-react';

interface CreditScoreData {
  score: number;
  tier: number;
  components: Record<string, { weight: number; score: number }>;
  creditLimitKobo: string;
}

const TIER_LABELS: Record<number, string> = {
  1: 'Starter',
  2: 'Reliable',
  3: 'Trusted',
  4: 'Proven',
  5: 'Elite',
};

export default function CreditScoreWidget() {
  const { data, isLoading } = useQuery<CreditScoreData>({
    queryKey: ['credit-score'],
    queryFn: () => api.get('/accounts/credit-score').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) return null;

  const limitNaira = Number(BigInt(data.creditLimitKobo)) / 100;
  const nextTier = Math.min(5, data.tier + 1);
  const scorePercent = ((data.score - 300) / 550) * 100;

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'hsl(142 71% 35% / 0.1)' }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: 'hsl(142 71% 35%)' }} />
          </div>
          <span className="font-serif text-sm font-medium">Credit Score</span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: 'hsl(142 71% 35% / 0.1)',
            color: 'hsl(142 71% 25%)',
          }}
        >
          Tier {data.tier} · {TIER_LABELS[data.tier]}
        </span>
      </div>

      {/* Score number */}
      <div>
        <p className="font-serif text-3xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
          {data.score}
          <span className="ml-1 text-base font-normal text-muted-foreground">/ 850</span>
        </p>
      </div>

      {/* Credit limit */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Credit Limit</span>
        <span className="font-serif text-lg font-semibold">
          ₦{limitNaira.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>300</span>
          <span>850</span>
        </div>
        <div
          className="h-3 rounded-full"
          style={{
            background: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, scorePercent))}%`,
              background: 'hsl(142 71% 35%)',
            }}
          />
        </div>
      </div>

      {/* Next tier hint */}
      <p className="text-[11px] text-muted-foreground">
        Next: <span className="font-medium text-foreground">{TIER_LABELS[nextTier]}</span> at {nextTier === 2 ? '500' : nextTier === 3 ? '600' : nextTier === 4 ? '700' : '800'}
      </p>

      {/* Methodology link */}
      <a
        href="/methodology"
        className="flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>How is this computed?</span>
        <ChevronRight className="h-3 w-3" />
      </a>
    </div>
  );
}
