import { useNavigate } from 'react-router-dom'
import {
  Sprout, TrendingUp, SplitSquareHorizontal, Clock, Hammer,
  Wallet, ArrowRight, ChevronRight, Sparkles, AlertTriangle, Briefcase,
} from 'lucide-react'
import { useFarmerDashboard } from '@/hooks/useFarmerDashboard'

const LEAF = 'hsl(142 71% 35%)'
const LEAF_DEEP = 'hsl(142 71% 25%)'
const LEAF_LIGHT = 'hsl(142 71% 35% / 0.1)'
const LEAF_BORDER = 'hsl(142 71% 35% / 0.25)'
const GOLD = 'hsl(43 96% 42%)'
const GOLD_LIGHT = 'hsl(43 96% 42% / 0.12)'
const GOLD_BORDER = 'hsl(43 96% 42% / 0.3)'
const CLAY = '#a0522d'
const CLAY_LIGHT = '#a0522d14'

function formatNaira(kobo: number | string | bigint) {
  const n = Number(kobo) / 100
  if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '₦' + Math.round(n / 1_000) + 'k'
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

function formatNairaFull(kobo: number | string | bigint) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

function purposeLabel(p: string) {
  const m: Record<string, string> = {
    WORKING: 'Working capital',
    BILLS: 'Bills & inputs',
    NEXT_SEASON: 'Next season',
  }
  return m[p] ?? p
}

function purposeIcon(p: string) {
  const m: Record<string, any> = { WORKING: Wallet, BILLS: Clock, NEXT_SEASON: Sprout }
  return m[p] ?? Wallet
}

function daysUntil(date: string | Date) {
  const ms = new Date(date).getTime() - Date.now()
  const days = Math.round(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-12 space-y-8">
      <div className="h-44 animate-pulse rounded-3xl" style={{ background: 'hsl(var(--muted))' }} />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-32 animate-pulse rounded-2xl" style={{ background: 'hsl(var(--muted))' }} />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl" style={{ background: 'hsl(var(--muted))' }} />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const nav = useNavigate()
  const { data, isLoading } = useFarmerDashboard()

  if (isLoading) return <Skeleton />

  const {
    farmer,
    accounts = [],
    activeDeferrals = [],
    jobs = { open: 0, filled: 0 },
    activeGigs = [],
    liberation = { month: { total: '0' }, allTime: { total: '0', byMiddlemanDiscount: '0', byCashOnDayPremium: '0' } },
    nextCashGap,
  } = data ?? {}

  const totalBalance = accounts.reduce((sum: bigint, a: any) => sum + BigInt(a.balanceKobo ?? 0), BigInt(0))
  const nextDeferral = activeDeferrals[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:py-12 space-y-8">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 lg:p-10"
        style={{
          background: `linear-gradient(135deg, ${LEAF_LIGHT} 0%, hsl(var(--card)) 70%)`,
          border: `1px solid ${LEAF_BORDER}`,
        }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 opacity-[0.05]">
          <Sprout className="h-56 w-56" style={{ color: LEAF }} />
        </div>

        <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: LEAF }}>
              {greeting}, {farmer?.name?.split(' ')[0] ?? 'farmer'}
            </p>
            <p className="font-serif text-5xl lg:text-6xl leading-none tracking-tight"
              style={{ color: 'hsl(var(--foreground))' }}>
              {formatNairaFull(totalBalance)}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Total across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
              {farmer?.cropType && <> · {farmer.cropType.toLowerCase()} farm in {farmer.region}</>}
            </p>
          </div>

          <div className="md:border-l md:pl-8" style={{ borderColor: LEAF_BORDER }}>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4"
              style={{ background: '#fff', border: `0.5px solid ${LEAF_BORDER}` }}>
              <Sparkles className="h-3 w-3" style={{ color: LEAF }} />
              <span className="text-xs font-semibold" style={{ color: LEAF_DEEP }}>
                Liberation captured
              </span>
            </div>
            <p className="font-serif text-3xl leading-none" style={{ color: 'hsl(var(--foreground))' }}>
              {formatNaira(liberation.allTime.total)}
            </p>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>Middleman discount avoided</span>
                <span style={{ color: 'hsl(var(--foreground))' }}>{formatNaira(liberation.allTime.byMiddlemanDiscount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>Cash-on-day premium</span>
                <span style={{ color: 'hsl(var(--foreground))' }}>{formatNaira(liberation.allTime.byCashOnDayPremium)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALERTS ───────────────────────────────────────────── */}
      {nextCashGap && (
        <button
          onClick={() => nav('/app/forecast')}
          className="flex w-full items-center gap-4 rounded-2xl px-6 py-5 text-left transition-opacity hover:opacity-95"
          style={{ background: GOLD, color: '#fff' }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
              Cash gap ahead
            </p>
            <p className="mt-1 font-serif text-lg leading-tight">
              {formatNairaFull(Math.abs(Number(nextCashGap.amountKobo)))} short {daysUntil(nextCashGap.date)}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </button>
      )}

      {/* ── ACCOUNTS GRID ────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
            Your accounts
          </h2>
          <button
            onClick={() => nav('/app/splits')}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: LEAF }}
          >
            Edit splits →
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {accounts.map((a: any) => {
            const Icon = purposeIcon(a.purpose)
            return (
              <div key={a.id} className="rounded-2xl p-5"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: LEAF_LIGHT }}>
                    <Icon className="h-4 w-4" style={{ color: LEAF }} />
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {a.squadAccountNumber}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {purposeLabel(a.purpose)}
                </p>
                <p className="mt-1 font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                  {formatNairaFull(a.balanceKobo)}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 2-COL: action + nav ──────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">

        {/* LEFT — active items */}
        <div className="space-y-6">

          {/* Active gigs needing attention */}
          {activeGigs.length > 0 && (
            <div>
              <h2 className="mb-4 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                Active gigs
              </h2>
              <div className="space-y-2">
                {activeGigs.map((gig: any) => {
                  const needsAction = gig.status === 'LABOURER_CONFIRMED_DONE'
                  return (
                    <button
                      key={gig.id}
                      onClick={() => nav('/app/jobs')}
                      className="group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all hover:shadow-sm"
                      style={{
                        background: 'hsl(var(--card))',
                        border: `1px solid ${needsAction ? CLAY : 'hsl(var(--border))'}`,
                      }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: CLAY_LIGHT }}>
                        <Hammer className="h-4 w-4" style={{ color: CLAY }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {needsAction && (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: CLAY }}>
                            Action needed
                          </p>
                        )}
                        <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                          {gig.jobTitle}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {gig.labourer.name} · Tier {gig.labourer.tier} · {formatNairaFull(gig.amountKobo)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        style={{ color: 'hsl(var(--muted-foreground))' }} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Jobs summary */}
          <div>
            <h2 className="mb-4 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
              Labour
            </h2>
            <button
              onClick={() => nav('/app/jobs')}
              className="group flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-all hover:shadow-sm"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: CLAY_LIGHT }}>
                <Briefcase className="h-5 w-5" style={{ color: CLAY }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                  {jobs.open + jobs.filled} {(jobs.open + jobs.filled) === 1 ? 'job' : 'jobs'} posted
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {jobs.open} open · {jobs.filled} filled
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'hsl(var(--muted-foreground))' }} />
            </button>
          </div>

          {/* Deferrals */}
          {activeDeferrals.length > 0 && (
            <div>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                  Deferrals
                </h2>
                <button
                  onClick={() => nav('/app/deferrals')}
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: LEAF }}
                >
                  View all →
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                {activeDeferrals.slice(0, 3).map((d: any, i: number) => (
                  <div key={d.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                    style={i > 0 ? { borderTop: '1px solid hsl(var(--border))' } : {}}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate" style={{ color: 'hsl(var(--foreground))' }}>
                        {d.supplierName}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Repays {daysUntil(d.repaymentDate)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                      {formatNairaFull(d.amountKobo)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — quick links */}
        <div>
          <h2 className="mb-4 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
            Quick actions
          </h2>
          <div className="space-y-2">
            {[
              { icon: TrendingUp, label: 'Forecast', sub: 'See cash flow ahead', to: '/app/forecast' },
              { icon: SplitSquareHorizontal, label: 'Splits', sub: 'Tune harvest routing', to: '/app/splits' },
              { icon: Clock, label: 'Deferrals', sub: 'Manage supplier credit', to: '/app/deferrals' },
              { icon: Hammer, label: 'Jobs', sub: 'Hire & rate labourers', to: '/app/jobs' },
            ].map(({ icon: Icon, label, sub, to }) => (
              <button
                key={to}
                onClick={() => nav(to)}
                className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:shadow-sm"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: LEAF_LIGHT }}>
                  <Icon className="h-4 w-4" style={{ color: LEAF }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: 'hsl(var(--muted-foreground))' }} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
