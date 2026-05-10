import { useState } from 'react'
import {
  Hammer, CheckCircle2, Clock, Star, Wallet, X, Briefcase,
  MapPin, TrendingUp, Sparkles, ArrowRight, ChevronRight,
} from 'lucide-react'
import {
  useLabourerDashboard, useLabourerGigs,
  useAcceptJob, useLabourerConfirmDone,
} from '@/hooks/useLabourer'

const CLAY = '#a0522d'
const CLAY_DEEP = '#7a3d20'
const CLAY_LIGHT = '#a0522d14'
const CLAY_BORDER = '#a0522d30'

function formatNaira(kobo: number | string | bigint) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

function tierLabel(tier: number) {
  const labels: Record<number, string> = {
    1: 'Newcomer', 2: 'Reliable', 3: 'Trusted', 4: 'Expert', 5: 'Elite',
  }
  return labels[tier] ?? `Tier ${tier}`
}

function gigNeedsLabourerConfirm(status: string) {
  return status === 'FARMER_CONFIRMED_DONE'
}

function gigStatusLabel(status: string) {
  const map: Record<string, string> = {
    ACCEPTED: 'Accepted',
    FARMER_CONFIRMED_DONE: 'Farmer confirmed — your turn',
    LABOURER_CONFIRMED_DONE: 'Confirmed — awaiting farmer',
    BOTH_CONFIRMED: 'Both confirmed — wage incoming',
    PAID: 'Paid',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
  }
  return map[status] ?? status
}

// ─── Dialog shell ────────────────────────────────────────────────────────────

function DialogShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-7 shadow-2xl"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 hover:bg-muted"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

// ─── Confirm done ────────────────────────────────────────────────────────────

function ConfirmDoneDialog({ gigId, jobTitle, onClose }: {
  gigId: string; jobTitle: string; onClose: () => void
}) {
  const [done, setDone] = useState(false)
  const confirm = useLabourerConfirmDone()

  async function handleConfirm() {
    await confirm.mutateAsync(gigId)
    setDone(true)
    setTimeout(onClose, 1700)
  }

  return (
    <DialogShell onClose={onClose}>
      {done ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: CLAY_LIGHT }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: CLAY }} />
          </div>
          <p className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>Done!</p>
          <p className="mt-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Your wage will be sent once both sides confirm.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: CLAY }}>
            Mark complete
          </p>
          <h2 className="mb-2 font-serif text-2xl leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
            Confirm job done
          </h2>
          <p className="mb-7 text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
            "{jobTitle}" — did you complete this job as agreed?
          </p>
          <button
            className="w-full rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: CLAY, color: '#fff' }}
            disabled={confirm.isPending}
            onClick={handleConfirm}
          >
            {confirm.isPending ? 'Confirming…' : 'Yes, I completed this job'}
          </button>
        </>
      )}
    </DialogShell>
  )
}

// ─── Accept job ──────────────────────────────────────────────────────────────

function AcceptJobDialog({ job, onClose }: { job: any; onClose: () => void }) {
  const [done, setDone] = useState(false)
  const accept = useAcceptJob()

  async function handleAccept() {
    await accept.mutateAsync(job.jobId)
    setDone(true)
    setTimeout(onClose, 1700)
  }

  return (
    <DialogShell onClose={onClose}>
      {done ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: CLAY_LIGHT }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: CLAY }} />
          </div>
          <p className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>Accepted</p>
          <p className="mt-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
            It will appear in your upcoming gigs.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: CLAY }}>
            New job · {Math.round((job.matchScore ?? 0) * 100)}% match
          </p>
          <h2 className="mb-5 font-serif text-2xl leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
            {job.title}
          </h2>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: 'hsl(var(--muted) / 0.6)' }}>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Pay</p>
              <p className="mt-1 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                {formatNaira(job.payAmountKobo)}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'hsl(var(--muted) / 0.6)' }}>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Duration</p>
              <p className="mt-1 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                {job.durationDays} day{job.durationDays !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {job.description && (
            <p className="mb-5 text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {job.description}
            </p>
          )}

          {job.skillsRequired?.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {job.skillsRequired.map((s: string) => (
                <span key={s} className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: CLAY_LIGHT, color: CLAY_DEEP }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: CLAY, color: '#fff' }}
            disabled={accept.isPending}
            onClick={handleAccept}
          >
            {accept.isPending ? 'Accepting…' : <>Accept this job <ArrowRight className="h-4 w-4" /></>}
          </button>
        </>
      )}
    </DialogShell>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <div className="h-44 animate-pulse rounded-3xl" style={{ background: 'hsl(var(--muted))' }} />
      <div className="space-y-3">
        {[140, 140, 140].map((h, i) => (
          <div key={i} className="animate-pulse rounded-2xl" style={{ height: h, background: 'hsl(var(--muted))' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LabourerDashboard() {
  const { data, isLoading } = useLabourerDashboard()
  const { data: gigsData } = useLabourerGigs()
  const [confirmGig, setConfirmGig] = useState<any>(null)
  const [acceptJob, setAcceptJob] = useState<any>(null)

  if (isLoading) return <Skeleton />

  const {
    labourer,
    savingsAccount,
    upcomingGigs = [],
    nearbyJobs = [],
    totalEarnedKobo = 0,
    completedGigsCount = 0,
  } = data ?? {}

  const allGigs: any[] = Array.isArray(gigsData) ? gigsData : (gigsData?.gigs ?? [])
  const completedGigs = allGigs.filter(g => ['PAID', 'CLOSED'].includes(g.status))
  const actionGig = upcomingGigs.find((g: any) => gigNeedsLabourerConfirm(g.status))
  const otherUpcoming = upcomingGigs.filter((g: any) => !gigNeedsLabourerConfirm(g.status))
  const sortedJobs = [...nearbyJobs].sort((a: any, b: any) => (b.matchScore ?? 0) - (a.matchScore ?? 0))

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:py-12 space-y-10">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 lg:p-10"
        style={{
          background: `linear-gradient(135deg, ${CLAY_LIGHT} 0%, hsl(var(--card)) 70%)`,
          border: `1px solid ${CLAY_BORDER}`,
        }}
      >
        {/* decorative corner glyph */}
        <div className="pointer-events-none absolute -right-8 -top-8 opacity-[0.06]">
          <Hammer className="h-48 w-48" style={{ color: CLAY }} />
        </div>

        <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">

          {/* Savings pot — emotional centerpiece */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5" style={{ color: CLAY }} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: CLAY }}>
                Your savings pot
              </p>
            </div>
            <p className="font-serif text-5xl lg:text-6xl leading-none tracking-tight"
              style={{ color: 'hsl(var(--foreground))' }}>
              {formatNaira(savingsAccount?.balanceKobo ?? 0)}
            </p>
            {savingsAccount?.squadAccountNumber && (
              <p className="mt-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Squad acct · {savingsAccount.squadAccountNumber}
              </p>
            )}
          </div>

          {/* Profile compact */}
          <div className="md:border-l md:pl-8" style={{ borderColor: CLAY_BORDER }}>
            <p className="font-serif text-2xl leading-tight"
              style={{ color: 'hsl(var(--foreground))' }}>
              {labourer?.name ?? 'Labourer'}
            </p>

            <div className="mt-1.5 flex items-center gap-1.5 text-sm"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {labourer?.region}
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: '#fff', border: `0.5px solid ${CLAY_BORDER}` }}>
              <Sparkles className="h-3 w-3" style={{ color: CLAY }} />
              <span className="text-xs font-semibold" style={{ color: CLAY_DEEP }}>
                Tier {labourer?.reputationTier ?? 1} · {tierLabel(labourer?.reputationTier ?? 1)}
              </span>
            </div>

            <div className="mt-5 flex gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Gigs
                </p>
                <p className="mt-0.5 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                  {completedGigsCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Total earned
                </p>
                <p className="mt-0.5 font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                  {formatNaira(totalEarnedKobo)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Skills row */}
        {labourer?.skills?.length > 0 && (
          <div className="relative mt-7 flex flex-wrap gap-1.5 pt-6"
            style={{ borderTop: `1px solid ${CLAY_BORDER}` }}>
            {labourer.skills.map((s: string) => (
              <span key={s} className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: '#fff', color: CLAY_DEEP, border: `0.5px solid ${CLAY_BORDER}` }}>
                {s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── ACTION BANNER (only when there's a gig awaiting labourer confirm) ── */}
      {actionGig && (
        <section
          className="overflow-hidden rounded-2xl"
          style={{ background: CLAY, color: '#fff' }}
        >
          <div className="flex items-center justify-between gap-4 p-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                Action needed
              </p>
              <p className="mt-1.5 font-serif text-xl leading-tight">
                Confirm "{actionGig.job?.title}" complete
              </p>
              <p className="mt-1 text-sm opacity-85">
                The farmer has confirmed. Your wage of{' '}
                <span className="font-semibold">{formatNaira(actionGig.agreedAmountKobo ?? 0)}</span>{' '}
                is waiting on your confirmation.
              </p>
            </div>
            <button
              className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ color: CLAY }}
              onClick={() => setConfirmGig(actionGig)}
            >
              Confirm done
            </button>
          </div>
        </section>
      )}

      {/* ── NEARBY JOBS ─────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
            Jobs near you
          </h2>
          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {sortedJobs.length} {sortedJobs.length === 1 ? 'match' : 'matches'}
          </p>
        </div>

        {sortedJobs.length === 0 ? (
          <div className="rounded-2xl px-6 py-10 text-center"
            style={{ background: 'hsl(var(--card))', border: '1px dashed hsl(var(--border))' }}>
            <Briefcase className="mx-auto mb-3 h-5 w-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              No nearby jobs right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedJobs.map((job: any, i: number) => {
              const score = Math.round((job.matchScore ?? 0) * 100)
              const isTop = i === 0

              return (
                <button
                  key={job.jobId}
                  onClick={() => setAcceptJob(job)}
                  className="group block w-full rounded-2xl p-6 text-left transition-all hover:shadow-md"
                  style={{
                    background: 'hsl(var(--card))',
                    border: `1px solid ${isTop ? CLAY_BORDER : 'hsl(var(--border))'}`,
                  }}
                >
                  <div className="flex items-start gap-5">
                    {/* match score circle */}
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
                      style={{ background: CLAY_LIGHT }}>
                      <span className="font-serif text-lg leading-none" style={{ color: CLAY_DEEP }}>
                        {score}
                      </span>
                      <span className="absolute bottom-1 text-[8px] font-semibold uppercase tracking-wider"
                        style={{ color: CLAY }}>
                        match
                      </span>
                    </div>

                    {/* content */}
                    <div className="min-w-0 flex-1">
                      {isTop && (
                        <div className="mb-1.5 inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" style={{ color: CLAY }} />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: CLAY }}>
                            Best match
                          </span>
                        </div>
                      )}

                      <p className="font-serif text-lg leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
                        {job.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                        style={{ color: 'hsl(var(--muted-foreground))' }}>
                        <span className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                          {formatNaira(job.payAmountKobo)}
                        </span>
                        <span className="opacity-50">·</span>
                        <span>{job.durationDays} day{job.durationDays !== 1 ? 's' : ''}</span>
                        <span className="opacity-50">·</span>
                        <span>
                          {job.expectedDate
                            ? new Date(job.expectedDate).toLocaleDateString('en-NG', {
                                day: 'numeric', month: 'short',
                              })
                            : '—'}
                        </span>
                      </div>

                      {job.skillsRequired?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {job.skillsRequired.slice(0, 4).map((s: string) => (
                            <span key={s} className="rounded-full px-2 py-0.5 text-[11px]"
                              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                              {s.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* arrow */}
                    <ChevronRight className="mt-2 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: CLAY }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── UPCOMING (non-action) ───────────────────────────────── */}
      {otherUpcoming.length > 0 && (
        <section>
          <h2 className="mb-5 font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
            Upcoming gigs
          </h2>
          <div className="space-y-2">
            {otherUpcoming.map((gig: any) => (
              <div key={gig.id}
                className="flex items-center justify-between gap-4 rounded-xl px-5 py-4"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                    {gig.job?.title ?? 'Gig'}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {gig.job?.expectedDate
                      ? new Date(gig.job.expectedDate).toLocaleDateString('en-NG', {
                          day: 'numeric', month: 'short',
                        })
                      : '—'}
                    {' · '}
                    {gigStatusLabel(gig.status)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                  {formatNaira(gig.agreedAmountKobo ?? gig.job?.payAmountKobo ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── HISTORY ─────────────────────────────────────────────── */}
      {completedGigs.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
              Recent gigs
            </h2>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {completedGigs.length} completed
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            {completedGigs.slice(0, 8).map((gig: any, i: number) => (
              <div
                key={gig.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
                style={i > 0 ? { borderTop: '1px solid hsl(var(--border))' } : {}}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: 'hsl(var(--foreground))' }}>
                    {gig.job?.title ?? 'Gig'}
                  </p>
                  {gig.rating && (
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className="h-3 w-3"
                          fill={n <= gig.rating.score ? 'hsl(43 96% 56%)' : 'transparent'}
                          style={{
                            color: n <= gig.rating.score ? 'hsl(43 96% 56%)' : 'hsl(var(--muted-foreground) / 0.4)',
                          }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                    {formatNaira(gig.agreedAmountKobo ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {gig.status === 'PAID' ? 'Paid' : 'Closed'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dialogs */}
      {confirmGig && (
        <ConfirmDoneDialog
          gigId={confirmGig.id}
          jobTitle={confirmGig.job?.title ?? 'this job'}
          onClose={() => setConfirmGig(null)}
        />
      )}
      {acceptJob && (
        <AcceptJobDialog job={acceptJob} onClose={() => setAcceptJob(null)} />
      )}
    </div>
  )
}
