import { X } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const CLAY = '#a0522d'

interface ScoreBreakdown {
  semantic: number
  distance: number
  reputation: number
  languageOverlap: number
  demandConfidence: number
}

interface Props {
  job: any
  open: boolean
  onClose: () => void
  onAccept: () => void
}

const COMPONENTS: { key: keyof ScoreBreakdown; label: string; sublabel: string }[] = [
  { key: 'semantic',         label: 'Skills match',      sublabel: 'How well your skills fit this job' },
  { key: 'distance',        label: 'How close',          sublabel: 'Distance from you to the farm' },
  { key: 'languageOverlap', label: 'Can communicate',    sublabel: 'You share a language with this farmer' },
  { key: 'reputation',      label: 'Your reputation',    sublabel: 'Based on your completed gigs' },
  { key: 'demandConfidence',label: 'Urgency',            sublabel: 'How soon the farmer needs help' },
]

function strengthLabel(score: number): { label: string; color: string } {
  if (score >= 0.75) return { label: 'Great', color: 'hsl(142 70% 45%)' }
  if (score >= 0.5)  return { label: 'Good',  color: 'hsl(43 96% 56%)' }
  return               { label: 'Fair',  color: 'hsl(var(--muted-foreground))' }
}

function formatNaira(kobo: number | string) {
  return '₦' + (Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

export function MatchDrawer({ job, open, onClose, onAccept }: Props) {
  if (!open || !job) return null

  const breakdown: ScoreBreakdown = job.scoreBreakdown ?? {
    semantic: 0.5, distance: 0.5, reputation: 0.5,
    languageOverlap: 0.5, demandConfidence: 0.5,
  }
  const overallPct = Math.round((job.matchScore ?? 0) * 100)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest font-sans font-semibold" style={{ color: CLAY }}>
              Why this job fits you
            </p>
            <h2 className="font-display text-2xl mt-1 leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
              {job.title}
            </h2>
            <p className="text-sm font-sans mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {formatNaira(job.payAmountKobo)} · {job.durationDays} day{job.durationDays !== 1 ? 's' : ''}
              {job.expectedDate && ` · ${format(parseISO(job.expectedDate), 'MMM d')}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 shrink-0 mt-1 transition-colors hover:bg-accent"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Overall score */}
        <div className="px-6 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${CLAY}18`, border: `1.5px solid ${CLAY}40` }}
          >
            <span className="font-display text-2xl tabular-nums" style={{ color: CLAY }}>
              {overallPct}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold font-sans" style={{ color: 'hsl(var(--foreground))' }}>
              {overallPct >= 75 ? 'Strong match' : overallPct >= 55 ? 'Good match' : 'Possible match'}
            </p>
            <p className="text-xs font-sans mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Based on your skills, location and history
            </p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {COMPONENTS.map(({ key, label, sublabel }) => {
            const val = breakdown[key] ?? 0.5
            const { label: strength, color } = strengthLabel(val)
            const pct = Math.round(val * 100)
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold font-sans" style={{ color: 'hsl(var(--foreground))' }}>
                      {label}
                    </p>
                    <p className="text-xs font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {sublabel}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold font-sans uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ml-3"
                    style={{ background: `${color}18`, color }}
                  >
                    {strength}
                  </span>
                </div>
                {/* Bar */}
                <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            )
          })}

          {/* Skills detail */}
          {job.skillsRequired?.length > 0 && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
              <p className="text-xs font-semibold uppercase tracking-wide font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Skills needed
              </p>
              <div className="flex flex-wrap gap-2">
                {job.skillsRequired.map((s: string) => (
                  <span
                    key={s}
                    className="text-xs font-sans px-2.5 py-1 rounded-full capitalize"
                    style={{ background: `${CLAY}15`, color: CLAY, border: `1px solid ${CLAY}30` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Accept button */}
        <div className="px-6 py-5" style={{ borderTop: '1px solid hsl(var(--border))' }}>
          <button
            onClick={onAccept}
            className="w-full rounded-xl py-3.5 text-sm font-semibold font-sans transition-opacity hover:opacity-90"
            style={{ background: CLAY, color: '#fff' }}
          >
            Accept this job
          </button>
        </div>
      </div>
    </div>
  )
}
