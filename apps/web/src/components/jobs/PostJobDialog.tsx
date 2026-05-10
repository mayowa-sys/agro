import { useState } from 'react'
import { X, Briefcase } from 'lucide-react'
import { useCreateJob } from '@/hooks/useJobs'
import { api } from '@/lib/api'

const SKILLS = [
  'PLANTING', 'WEEDING', 'HARVESTING', 'PESTICIDE_APPLICATION',
  'LAND_PREPARATION', 'IRRIGATION', 'SORTING', 'LOADING',
] as const

interface Props {
  open: boolean
  onClose: () => void
  prefill?: {
    title?: string
    amountKobo?: number
    expectedDate?: string
  }
}

function formatNaira(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

export default function PostJobDialog({ open, onClose, prefill }: Props) {
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [amountKobo, setAmountKobo] = useState(prefill?.amountKobo ?? 0)
  const [amountInput, setAmountInput] = useState(
    prefill?.amountKobo ? String(Math.round(prefill.amountKobo / 100)) : ''
  )
  const [expectedDate, setExpectedDate] = useState(prefill?.expectedDate ?? '')
  const [workersNeeded, setWorkersNeeded] = useState(1)
  const [skills, setSkills] = useState<string[]>([])
  const [toast, setToast] = useState('')

  const createJob = useCreateJob()

  if (!open) return null

  function toggleSkill(skill: string) {
    setSkills(s => s.includes(skill) ? s.filter(x => x !== skill) : [...s, skill])
  }

  function handleAmountChange(val: string) {
    const digits = val.replace(/\D/g, '')
    setAmountInput(digits)
    setAmountKobo(Number(digits) * 100)
  }

  async function handleSubmit() {
    if (!title || !amountKobo || !expectedDate) return
    try {
      await createJob.mutateAsync({
        title,
        description: title,
        amountKobo,
        expectedDate,
        workersNeeded,
        skillsRequired: skills,
      })
      setToast('Job posted. We\'ll show it to nearby labourers.')
      setTimeout(() => { setToast(''); onClose() }, 2200)
    } catch {
      setToast('Failed to post job. Try again.')
      setTimeout(() => setToast(''), 2500)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'hsl(var(--primary) / 0.12)' }}
          >
            <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div>
            <h2 className="font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
              Post a Job
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
              We'll match nearby labourers to your posting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 transition-colors hover:bg-muted"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
              Job title
            </label>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                background: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              }}
              placeholder="e.g. Cassava harvest help needed"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
              Pay (₦)
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                ₦
              </span>
              <input
                className="w-full rounded-xl border py-2.5 pl-7 pr-3 text-sm outline-none transition-colors focus:ring-2"
                style={{
                  background: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
                inputMode="numeric"
                placeholder="35000"
                value={amountInput}
                onChange={e => handleAmountChange(e.target.value)}
              />
            </div>
            {amountKobo > 0 && (
              <p className="mt-1 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {formatNaira(amountKobo)}
              </p>
            )}
          </div>

          {/* Expected date */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
              Expected date
            </label>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                background: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              }}
              value={expectedDate}
              onChange={e => setExpectedDate(e.target.value)}
            />
          </div>

          {/* Workers needed */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
              Workers needed
            </label>
            <div className="flex items-center gap-3">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-lg font-medium transition-colors hover:bg-muted"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                onClick={() => setWorkersNeeded(n => Math.max(1, n - 1))}
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                {workersNeeded}
              </span>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg border text-lg font-medium transition-colors hover:bg-muted"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                onClick={() => setWorkersNeeded(n => Math.min(20, n + 1))}
              >
                +
              </button>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'hsl(var(--foreground))' }}>
              Skills required <span style={{ color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map(skill => {
                const active = skills.includes(skill)
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: active ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      border: '1px solid',
                      borderColor: active ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    }}
                  >
                    {skill.replace(/_/g, ' ')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          className="mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
          }}
          disabled={!title || !amountKobo || !expectedDate || createJob.isPending}
          onClick={handleSubmit}
        >
          {createJob.isPending ? 'Posting…' : 'Post job →'}
        </button>

        {/* Toast */}
        {toast && (
          <div
            className="mt-3 rounded-xl px-4 py-2.5 text-center text-sm font-medium"
            style={{
              background: toast.startsWith('Failed') ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--primary) / 0.12)',
              color: toast.startsWith('Failed') ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
