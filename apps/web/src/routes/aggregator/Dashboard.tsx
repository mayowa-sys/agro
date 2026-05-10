import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Building2, TrendingUp, Users, ArrowRightLeft, Sparkles } from 'lucide-react';

interface AggregatorDashboard {
  businessName: string;
  activeAdvances: number;
  totalAdvances: number;
  farmerCount: number;
  totalVolumeLastMonth: string;
  liberationContributed: string;
  recentAdvances: Array<{
    id: string;
    farmerName: string;
    amount: string;
    fee: string;
    status: string;
    createdAt: string;
  }>;
}

function formatNaira(kobo: string | bigint) {
  const n = Number(kobo) / 100;
  if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '₦' + Math.round(n / 1_000) + 'k';
  return '₦' + n.toLocaleString('en-NG');
}

const BLUE = 'hsl(217 91% 60%)';
const BLUE_LIGHT = 'hsl(217 91% 60% / 0.1)';

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: BLUE_LIGHT }}>
          <Icon className="h-4 w-4" style={{ color: BLUE }} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="font-serif text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AggregatorDashboard() {
  const { data, isLoading } = useQuery<AggregatorDashboard>({
    queryKey: ['aggregator-dashboard'],
    queryFn: () => api.get('/aggregator/me/dashboard').then(r => r.data),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-44 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-12 space-y-8">
      {/* Hero */}
      <section
        className="rounded-3xl p-8 lg:p-10"
        style={{
          background: `linear-gradient(135deg, ${BLUE_LIGHT} 0%, hsl(var(--card)) 70%)`,
          border: '1px solid hsl(217 91% 60% / 0.25)',
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: BLUE }}>
          Aggregator Portal
        </p>
        <h1 className="mt-2 font-serif text-4xl lg:text-5xl">{data.businessName}</h1>
      </section>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ArrowRightLeft} label="Active Advances" value={String(data.activeAdvances)} />
        <StatCard icon={Users} label="Farmers" value={String(data.farmerCount)} sub="on roster" />
        <StatCard icon={TrendingUp} label="30-Day Volume" value={formatNaira(data.totalVolumeLastMonth)} />
        <StatCard icon={Sparkles} label="Liberation" value={formatNaira(data.liberationContributed)} sub="contributed" />
      </div>

      {/* Recent advances */}
      <section>
        <h2 className="font-serif text-2xl mb-4">Recent Advances</h2>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        >
          {data.recentAdvances.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-5 py-4"
              style={i > 0 ? { borderTop: '1px solid hsl(var(--border))' } : {}}
            >
              <div>
                <p className="text-sm font-medium">{a.farmerName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString('en-NG')} · {a.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatNaira(a.amount)}</p>
                <p className="text-xs text-muted-foreground">Fee: {formatNaira(a.fee)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
