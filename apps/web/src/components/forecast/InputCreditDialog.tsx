import { useState, useEffect } from 'react'
import { X, Sprout } from 'lucide-react'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { formatNaira } from '@/lib/format'

interface Supplier {
  id: string
  name: string
  region: string
}

interface Props {
  open: boolean
  onClose: () => void
  prefillAmountKobo?: number
  prefillEndDate?: string
}

const LEAF = 'hsl(142 70% 45%)'

export function InputCreditDialog({ open, onClose, prefillAmountKobo, prefillEndDate }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [amountNaira, setAmountNaira] = useState('')
  const [repayDate, setRepayDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    if (!open) return
    api.get('/deferrals/suppliers').then(r => {
      setSuppliers(r.data)
      if (r.data.length > 0) setSupplierId(r.data[0].id)
    })
    // Pre-fill from gap data
    if (prefillAmountKobo) {
      setAmountNaira(Math.ceil(prefillAmountKobo / 100).toString())
    }
    if (prefillEndDate) {
      // Use harvest date as repay date
      setRepayDate(prefillEndDate.split('T')[0])
    } else {
      // Default: 6 months from now
      const d = new Date()
      d.setMonth(d.getMonth() + 6)
      setRepayDate(d.toISOString().split('T')[0])
    }
    setError('')
    setSuccess(false)
  }, [open, prefillAmountKobo, prefillEndDate])

  async function handleSubmit() {
    if (!supplierId) { setError('Select a supplier'); return }
    const amount = parseFloat(amountNaira)
    if (!amount || amount < 1000) { setError('Minimum amount is ₦1,000'); return }
    if (!repayDate) { setError('Select a repayment date'); return }

    setLoading(true); setError('')
    try {
      await api.post('/deferrals', {
        supplierId,
        amount,
        expectedRepayDate: new Date(repayDate).toISOString(),
      })
      await qc.invalidateQueries({ queryKey: ['deferrals'] })
      await qc.invalidateQueries({ queryKey: ['forecast'] });
      await qc.invalidateQueries({ queryKey: ['projected-balance'] });
      setSuccess(true)
      setTimeout(() => { onClose(); setSuccess(false) }, 1800)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2.5" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <Sprout size={18} style={{ color: LEAF }} />
            </div>
            <div>
              <h2 className="font-display text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                Input Credit
              </h2>
              <p className="text-xs font-sans mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Buy now · repay on harvest day
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-accent mt-1"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <Sprout size={22} style={{ color: LEAF }} />
            </div>
            <p className="font-display text-xl" style={{ color: 'hsl(var(--foreground))' }}>Request submitted</p>
            <p className="text-sm font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Your input credit is pending approval
            </p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {prefillAmountKobo && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <p className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: LEAF }}>
                  Pre-filled from your cash gap
                </p>
                <p className="text-sm font-sans mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Covers your predicted shortfall of {formatNaira(prefillAmountKobo, { compact: true })}
                </p>
              </div>
            )}

            {/* Supplier */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Supplier
              </label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-sans outline-none"
                style={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} · {s.region}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Amount (₦)
              </label>
              <input
                type="number"
                value={amountNaira}
                onChange={e => setAmountNaira(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-xl px-4 py-3 text-sm font-sans outline-none"
                style={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
            </div>

            {/* Repay date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Expected repayment date
              </label>
              <input
                type="date"
                value={repayDate}
                onChange={e => setRepayDate(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-sans outline-none"
                style={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
            </div>

            {error && (
              <p className="text-xs font-sans" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl py-3 text-sm font-semibold font-sans transition-colors"
                style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 rounded-xl py-3 text-sm font-semibold font-sans transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: LEAF, color: '#fff' }}
              >
                {loading ? 'Submitting…' : 'Request credit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
