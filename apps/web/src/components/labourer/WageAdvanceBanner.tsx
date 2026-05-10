import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

const CLAY = '#a0522d'

interface Props {
  labourerId?: string
  onSuccess: () => void
}

export function WageAdvanceBanner({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  async function handleRequest() {
    const kobo = Math.round(parseFloat(amount) * 100)
    if (!kobo || kobo < 50000) { setError('Minimum advance is ₦500'); return }
    setLoading(true); setError('')
    try {
      await api.post('/wage-advances', { requestedKobo: kobo })
      await qc.invalidateQueries({ queryKey: ['wage-advances'] })
      setOpen(false); setAmount('')
      onSuccess()
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section
        className="rounded-2xl p-5"
        style={{ background: 'hsl(var(--card))', border: `1px solid ${CLAY}33` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl p-2.5 shrink-0" style={{ background: `${CLAY}18` }}>
              <Banknote className="h-5 w-5" style={{ color: CLAY }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                Wage advance available
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Tier 3 benefit · repaid from next wage
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: CLAY, color: '#fff' }}
          >
            Request
          </button>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-5"
            style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
          >
            <div>
              <h2 className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                Request advance
              </h2>
              <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Up to ₦5,000 · deducted automatically from your next wage payment
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Amount (₦)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
                style={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              {error && <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setOpen(false); setError('') }}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold"
                style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequest}
                disabled={loading}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: CLAY, color: '#fff' }}
              >
                {loading ? 'Requesting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
