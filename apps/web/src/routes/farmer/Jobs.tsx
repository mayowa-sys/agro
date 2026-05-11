import { useState, useEffect } from 'react'
import { Clock, Star, ChevronDown, ChevronUp, X, CheckCircle2 } from 'lucide-react'
import {
  useMyJobs,
  useMyGigs,
  useConfirmGigDone,
  useRateLabourer,
  useGig,
} from '@/hooks/useJobs'

function formatNaira(kobo: number | string | bigint) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

const ACTIVE_STATUSES = ['ACCEPTED', 'FARMER_CONFIRMED_DONE', 'LABOURER_CONFIRMED_DONE', 'BOTH_CONFIRMED']
const COMPLETED_STATUSES = ['PAID', 'CLOSED']

function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    OPEN:      { label: 'Open',      bg: 'hsl(var(--primary) / 0.12)',     fg: 'hsl(var(--primary))' },
    FILLED:    { label: 'Filled',    bg: 'hsl(142 71% 45% / 0.12)',        fg: 'hsl(142 71% 35%)' },
    CANCELLED: { label: 'Cancelled', bg: 'hsl(var(--destructive) / 0.12)', fg: 'hsl(var(--destructive))' },
  }
  const s = map[status] ?? { label: status, bg: 'hsl(var(--muted))', fg: 'hsl(var(--muted-foreground))' }
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function gigStatusLabel(status: string) {
  const map: Record<string, string> = {
    ACCEPTED: 'Accepted',
    FARMER_CONFIRMED_DONE: 'You confirmed',
    LABOURER_CONFIRMED_DONE: 'Labourer confirmed',
    BOTH_CONFIRMED: 'Both confirmed',
    PAID: 'Paid',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
  }
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
      {map[status] ?? status}
    </span>
  )
}

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(n)}>
          <Star className="h-6 w-6 transition-colors"
            fill={(hover || value) >= n ? 'hsl(43 96% 56%)' : 'transparent'}
            style={{ color: (hover || value) >= n ? 'hsl(43 96% 56%)' : 'hsl(var(--muted-foreground))' }} />
        </button>
      ))}
    </div>
  )
}

function ConfirmDoneDialog({ gigId, labourerName, onClose }: {
  gigId: string; labourerName: string; onClose: () => void
}) {
  const [step, setStep] = useState<'confirm' | 'rate' | 'waiting' | 'done'>('confirm')
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const confirmGig = useConfirmGigDone()
  const rateLabourer = useRateLabourer()
  const { data: gigData } = useGig(gigId)
  const currentStatus = gigData?.status ?? gigData?.gig?.status

  // If gig is already resolved, skip straight to rating or close
  useEffect(() => {
    if (currentStatus === 'PAID' || currentStatus === 'CLOSED' || currentStatus === 'BOTH_CONFIRMED') {
      setStep('rate')
    }
  }, [currentStatus])
  const { refetch } = useGig(gigId)

  async function handleConfirm() {
    await confirmGig.mutateAsync(gigId)
    const { data: fresh } = await refetch()
    const status = fresh?.status ?? fresh?.gig?.status
    if (status === 'BOTH_CONFIRMED' || status === 'PAID') {
      setStep('rate')
    } else {
      setStep('waiting')
    }
  }

  async function handleRate() {
    if (!score) return
    await rateLabourer.mutateAsync({ id: gigId, score, comment })
    setStep('done')
    setTimeout(onClose, 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 hover:bg-muted"
          style={{ color: 'hsl(var(--muted-foreground))' }}>
          <X className="h-4 w-4" />
        </button>

        {step === 'confirm' && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Confirm job done</h2>
            </div>
            <p className="mb-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Did {labourerName} complete the job as agreed?
            </p>
            <button className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              disabled={confirmGig.isPending} onClick={handleConfirm}>
              {confirmGig.isPending ? 'Confirming…' : 'Yes, job complete'}
            </button>
          </>
        )}

        {step === 'waiting' && (
          <>
            <div className="mb-1 flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <h2 className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Waiting on {labourerName}</h2>
            </div>
            <p className="mt-2 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              You've confirmed. You'll be able to rate once {labourerName} confirms their side.
            </p>
            <button className="mt-6 w-full rounded-xl py-3 text-sm font-semibold"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }} onClick={onClose}>
              Close
            </button>
          </>
        )}

        {step === 'rate' && (
          <>
            <h2 className="mb-1 font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Rate {labourerName}</h2>
            <p className="mb-4 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>How did they do?</p>
            <StarRow value={score} onChange={setScore} />
            <textarea className="mt-4 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))', minHeight: 72, resize: 'none' }}
              placeholder="Optional comment…" value={comment} onChange={e => setComment(e.target.value)} />
            <button className="mt-4 w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              disabled={!score || rateLabourer.isPending} onClick={handleRate}>
              {rateLabourer.isPending ? 'Submitting…' : 'Submit rating'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8" style={{ color: 'hsl(var(--primary))' }} />
            <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Rating submitted</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-24 animate-pulse rounded-2xl" style={{ background: 'hsl(var(--muted))' }} />
      ))}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{message}</p>
    </div>
  )
}

function MyJobsTab() {
  const { data, isLoading } = useMyJobs()
  const [expanded, setExpanded] = useState<string | null>(null)
  const jobs: any[] = Array.isArray(data) ? data : (data?.jobs ?? [])

  if (isLoading) return <Skeleton />
  if (!jobs.length) return <Empty message="No jobs posted yet. Post one from the Forecast page." />

  return (
    <div className="space-y-3">
      {jobs.map((job: any) => (
        <div key={job.id} className="rounded-2xl p-4"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{job.title}</p>
              <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {job.expectedDate ? new Date(job.expectedDate).toLocaleDateString('en-NG') : '—'}
                {' · '}
                {formatNaira(job.payAmountKobo ?? 0)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {statusBadge(job.status)}
              <button onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                style={{ color: 'hsl(var(--muted-foreground))' }}>
                {expanded === job.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {expanded === job.id && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'hsl(var(--border))' }}>
              {job.gigs?.length ? (
                <div className="space-y-2">
                  {job.gigs.map((gig: any) => (
                    <div key={gig.id} className="flex items-center justify-between text-sm"
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <span>{gig.labourer?.fullName ?? 'Labourer'}{gig.labourer?.reputationTier ? ` · Tier ${gig.labourer.reputationTier}` : ''}</span>
                      {gigStatusLabel(gig.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No accepted gigs yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ActiveGigsTab() {
  const { data, isLoading } = useMyGigs()
  const [dialogGig, setDialogGig] = useState<any>(null)
  const allGigs: any[] = Array.isArray(data) ? data : (data?.gigs ?? [])
  const gigs = allGigs.filter(g => ACTIVE_STATUSES.includes(g.status))

  if (isLoading) return <Skeleton />
  if (!gigs.length) return <Empty message="No active gigs right now." />

  const farmerConfirmed = (g: any) =>
    ['FARMER_CONFIRMED_DONE', 'BOTH_CONFIRMED', 'PAID'].includes(g.status)

  return (
    <>
      <div className="space-y-3">
        {gigs.map((gig: any) => (
          <div key={gig.id} className="rounded-2xl p-4"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                  {gig.job?.title ?? 'Gig'}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {gig.labourer?.fullName ?? 'Labourer'}
                  {gig.labourer?.reputationTier ? ` · Tier ${gig.labourer.reputationTier}` : ''}
                </p>
                <p className="mt-0.5 text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                  {formatNaira(gig.agreedAmountKobo ?? 0)}
                </p>
              </div>
              {gigStatusLabel(gig.status)}
            </div>
            <div className="mt-3">
              {farmerConfirmed(gig) ? (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                  <Clock className="h-4 w-4 shrink-0" />
                  Waiting on labourer to confirm
                </div>
              ) : (
                <button className="w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  onClick={() => setDialogGig(gig)}>
                  Confirm job done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {dialogGig && (
        <ConfirmDoneDialog gigId={dialogGig.id}
          labourerName={dialogGig.labourer?.fullName ?? 'the labourer'}
          onClose={() => setDialogGig(null)} />
      )}
    </>
  )
}

function CompletedGigsTab() {
  const { data, isLoading } = useMyGigs()
  const [dialogGig, setDialogGig] = useState<any>(null)
  const allGigs: any[] = Array.isArray(data) ? data : (data?.gigs ?? [])
  const gigs = allGigs.filter(g => COMPLETED_STATUSES.includes(g.status))

  if (isLoading) return <Skeleton />
  if (!gigs.length) return <Empty message="No completed gigs yet." />

  return (
    <>
      <div className="space-y-3">
        {gigs.map((gig: any) => {
          const rated = !!gig.rating
          return (
            <div key={gig.id} className="rounded-2xl p-4"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                    {gig.job?.title ?? 'Gig'}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {gig.labourer?.fullName ?? 'Labourer'}
                  </p>
                  <p className="mt-0.5 text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                    {formatNaira(gig.agreedAmountKobo ?? 0)}
                  </p>
                  {rated && (
                    <div className="mt-1.5 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className="h-3.5 w-3.5" fill={n <= (gig.rating?.farmerScoreOfLabourer ?? 0) ? 'hsl(43 96% 56%)' : 'transparent'}
                              style={{ color: n <= (gig.rating?.farmerScoreOfLabourer ?? 0) ? 'hsl(43 96% 56%)' : 'hsl(var(--muted-foreground))' }} />
                      ))}
                    </div>
                  )}
                </div>
                {gigStatusLabel(gig.status)}
              </div>
              {!rated && gig.status === 'PAID' && (
                <button className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  onClick={() => setDialogGig(gig)}>
                  Rate labourer
                </button>
              )}
            </div>
          )
        })}
      </div>
      {dialogGig && (
        <ConfirmDoneDialog gigId={dialogGig.id}
          labourerName={dialogGig.labourer?.fullName ?? 'the labourer'}
          onClose={() => setDialogGig(null)} />
      )}
    </>
  )
}

type Tab = 'jobs' | 'active' | 'completed'

export default function Jobs() {
  const [tab, setTab] = useState<Tab>('jobs')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'jobs',      label: 'My Jobs' },
    { id: 'active',    label: 'Active Gigs' },
    { id: 'completed', label: 'Completed' },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
        Jobs &amp; Gigs
      </h1>
      <div className="mb-5 flex rounded-xl p-1" style={{ background: 'hsl(var(--muted))' }}>
        {tabs.map(t => (
          <button key={t.id} className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
            style={tab === t.id
              ? { background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: 'hsl(var(--muted-foreground))' }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'jobs'      && <MyJobsTab />}
      {tab === 'active'    && <ActiveGigsTab />}
      {tab === 'completed' && <CompletedGigsTab />}
    </div>
  )
}
