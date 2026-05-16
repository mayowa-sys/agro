import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Sprout, ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
const CLAY = '#a0522d'
const ORANGE = 'rgb(249,115,22)'

interface CreditScoreResp {
  score: number
  tier: number
  creditLimitKobo: string | number
}

interface DeferralResp {
  status: string
  amount: string | number
  agroFee?: string | number | null
}

export function InputCreditDialog({ open, onClose, prefillAmountKobo, prefillEndDate }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [amountNaira, setAmountNaira] = useState('')
  const [repayDate, setRepayDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [approvalBeat, setApprovalBeat] = useState<'idle'|'reviewing'|'approved'|'done'>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qc = useQueryClient()

  // ── Live credit-score + outstanding lookup ──────────────────────────
  const { data: creditScore } = useQuery<CreditScoreResp>({
    queryKey: ['credit-score'],
    queryFn: () => api.get('/accounts/credit-score').then(r => r.data),
    enabled: open,
  })

  const { data: existingDeferrals } = useQuery<DeferralResp[]>({
    queryKey: ['deferrals'],
    queryFn: () => api.get('/deferrals/me').then(r => r.data),
    enabled: open,
  })

  const { creditLimitKobo, outstandingKobo, availableKobo, tier } = useMemo(() => {
    const limit = Number(creditScore?.creditLimitKobo ?? 0)
    const tier = creditScore?.tier ?? 1
    const outstanding = (existingDeferrals ?? [])
      .filter(d => ['PENDING', 'DISBURSED', 'ACTIVE'].includes(d.status))
      .reduce((s, d) => s + Number(d.amount) + Number(d.agroFee ?? 0), 0)
    const available = Math.max(0, limit - outstanding)
    return {
      creditLimitKobo: limit,
      outstandingKobo: outstanding,
      availableKobo: available,
      tier,
    }
  }, [creditScore, existingDeferrals])

  const availableNaira = Math.floor(availableKobo / 100)
  const limitNaira = Math.floor(creditLimitKobo / 100)
  const outstandingNaira = Math.floor(outstandingKobo / 100)

  // ── Init on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    api.get('/deferrals/suppliers').then(r => {
      setSuppliers(r.data)
      if (r.data.length > 0) setSupplierId(r.data[0].id)
    })

    // Pre-fill amount: clamp to available if provided
    if (prefillAmountKobo) {
      const requestNaira = Math.ceil(prefillAmountKobo / 100)
      // We may not have credit score loaded yet on first open — clamp later if needed.
      setAmountNaira(requestNaira.toString())
    } else {
      setAmountNaira('')
    }

    if (prefillEndDate) {
      setRepayDate(prefillEndDate.split('T')[0])
    } else {
      const d = new Date()
      d.setMonth(d.getMonth() + 6)
      setRepayDate(d.toISOString().split('T')[0])
    }
    setError('')
    setApprovalBeat('idle')
  }, [open, prefillAmountKobo, prefillEndDate])

  // Re-clamp the prefilled amount once credit score arrives
  useEffect(() => {
    if (!open || !prefillAmountKobo || !creditScore) return
    const requestNaira = Math.ceil(prefillAmountKobo / 100)
    if (requestNaira > availableNaira && availableNaira > 0) {
      setAmountNaira(availableNaira.toString())
    }
  }, [open, prefillAmountKobo, creditScore, availableNaira])

  // ── Live validation ─────────────────────────────────────────────────
  const amountInputNaira = parseFloat(amountNaira) || 0
  const amountInputKobo = Math.round(amountInputNaira * 100)
  const exceedsAvailable = amountInputKobo > 0 && amountInputKobo > availableKobo
  const belowMin = amountInputKobo > 0 && amountInputKobo < 100_000

  // Live preview of fee + total
  const feePct = 6
  const feeKobo = Math.floor((amountInputKobo * feePct) / 100)
  const totalDueKobo = amountInputKobo + feeKobo

  // Clean up poller on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function handleSubmit() {
    if (!supplierId) { setError('Select a supplier'); return }
    if (amountInputNaira < 1000) { setError('Minimum amount is ₦1,000'); return }
    if (exceedsAvailable) {
      setError(`Amount exceeds your available credit of ${formatNaira(availableKobo, { compact: true })}`)
      return
    }
    if (!repayDate) { setError('Select a repayment date'); return }
    setLoading(true); setError(''); setApprovalBeat('reviewing')
    try {
      const resp = await api.post('/deferrals', {
        supplierId,
        amount: amountInputNaira,
        expectedRepayDate: new Date(repayDate).toISOString(),
      })
      const deferralId: string = resp.data.id
      setLoading(false)

      // Poll for DISBURSED status — backend auto-approves after 2.5s
      pollRef.current = setInterval(async () => {
        try {
          const list = await api.get('/deferrals/me')
          const found = list.data.find((d: any) => d.id === deferralId)
          if (found?.status === 'DISBURSED') {
            clearInterval(pollRef.current!)
            setApprovalBeat('approved')
            // Invalidate everything now that disbursement is confirmed
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['deferrals'] }),
              qc.invalidateQueries({ queryKey: ['forecast'] }),
              qc.invalidateQueries({ queryKey: ['projected-balance'] }),
              qc.invalidateQueries({ queryKey: ['cash-gaps'] }),
              qc.invalidateQueries({ queryKey: ['credit-score'] }),
              qc.invalidateQueries({ queryKey: ['dashboard'] }),
            ])
            setTimeout(() => {
              setApprovalBeat('done')
              setTimeout(() => { onClose(); setApprovalBeat('idle') }, 600)
            }, 1800)
          }
        } catch (_) {}
      }, 800)

      // Safety timeout — if backend never approves within 10s, show error
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          setApprovalBeat('idle')
          setError('Approval is taking longer than expected. Check Input Credits page.')
        }
      }, 10000)

    } catch (e: any) {
      setLoading(false)
      setApprovalBeat('idle')
      setError(e?.response?.data?.error ?? 'Something went wrong')
    }
  }

  if (!open) return null

  const limitProgressPct = creditLimitKobo > 0
    ? Math.min(100, (outstandingKobo / creditLimitKobo) * 100)
    : 0

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

        {approvalBeat !== 'idle' ? (
          <div className="px-6 py-12 text-center space-y-4">
            {approvalBeat === 'reviewing' && (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(34,197,94,0.10)', border: '2px solid rgba(34,197,94,0.25)' }}>
                  <Loader2 size={26} style={{ color: LEAF }} className="animate-spin" />
                </div>
                <p className="font-display text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                  Reviewing…
                </p>
                <p className="text-sm font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  AGRO risk engine is evaluating your request
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {['Credit score', 'Repayment history', 'Forecast confidence'].map((label, i) => (
                    <span key={label}
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full font-sans"
                      style={{
                        background: 'hsl(var(--muted))',
                        color: 'hsl(var(--muted-foreground))',
                        animation: `fadeIn 0.4s ease-out ${i * 0.3 + 0.2}s both`,
                      }}>
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
            {(approvalBeat === 'approved' || approvalBeat === 'done') && (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.4)' }}>
                  <CheckCircle2 size={28} style={{ color: LEAF }} />
                </div>
                <p className="font-display text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                  Approved
                </p>
                <p className="text-sm font-sans font-semibold" style={{ color: LEAF }}>
                  ₦{amountInputNaira.toLocaleString('en-NG')} disbursed to supplier
                </p>
                <p className="text-sm font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Your forecast has been updated. Repayment will be collected automatically at harvest.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* ── Available credit panel ─────────────────────────── */}
            {creditScore && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: availableKobo > 0
                    ? 'rgba(34,197,94,0.06)'
                    : 'rgba(249,115,22,0.06)',
                  border: `1px solid ${availableKobo > 0 ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.3)'}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={12} style={{ color: availableKobo > 0 ? LEAF : ORANGE }} />
                      <p className="text-[10px] font-semibold uppercase tracking-wider font-sans" style={{ color: availableKobo > 0 ? LEAF : ORANGE }}>
                        Available credit
                      </p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full font-sans tabular-nums"
                        style={{
                          background: 'hsl(var(--muted))',
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      >
                        Tier {tier}
                      </span>
                    </div>
                    <p className="font-display text-2xl mt-0.5 tabular-nums" style={{ color: 'hsl(var(--foreground))' }}>
                      {formatNaira(availableKobo, { compact: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Total limit
                    </p>
                    <p className="text-sm font-sans tabular-nums" style={{ color: 'hsl(var(--foreground))' }}>
                      {formatNaira(creditLimitKobo, { compact: true })}
                    </p>
                  </div>
                </div>
                {/* Mini progress bar — outstanding vs limit */}
                <div className="mt-2.5 space-y-1">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${limitProgressPct}%`,
                        background: limitProgressPct >= 80 ? ORANGE : LEAF,
                      }}
                    />
                  </div>
                  <p className="text-[10px] font-sans tabular-nums" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {formatNaira(outstandingKobo, { compact: true })} outstanding · {limitProgressPct.toFixed(0)}% utilized
                  </p>
                </div>
              </div>
            )}

            {prefillAmountKobo && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <p className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: LEAF }}>
                  Pre-filled from your cash gap
                </p>
                <p className="text-sm font-sans mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {prefillAmountKobo > availableKobo && availableKobo > 0
                    ? `Capped at your available limit. (Full gap: ${formatNaira(prefillAmountKobo, { compact: true })})`
                    : `Covers your predicted shortfall of ${formatNaira(prefillAmountKobo, { compact: true })}`}
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

            {/* Amount with live validation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Amount (₦)
                </label>
                {availableNaira > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountNaira(availableNaira.toString())}
                    className="text-[10px] font-sans uppercase tracking-wider px-2 py-0.5 rounded-md transition-colors hover:opacity-80"
                    style={{
                      background: 'rgba(34,197,94,0.1)',
                      color: LEAF,
                    }}
                  >
                    Use max
                  </button>
                )}
              </div>
              <input
                type="number"
                value={amountNaira}
                onChange={e => setAmountNaira(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-xl px-4 py-3 text-sm font-sans outline-none transition-colors"
                style={{
                  background: 'hsl(var(--background))',
                  border: `1px solid ${exceedsAvailable ? ORANGE : 'hsl(var(--border))'}`,
                  color: 'hsl(var(--foreground))',
                }}
              />
              {/* Live feedback line */}
              {amountInputKobo > 0 && (
                exceedsAvailable ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-sans" style={{ color: ORANGE }}>
                    <AlertCircle size={11} />
                    Exceeds available by {formatNaira(amountInputKobo - availableKobo, { compact: true })}
                  </div>
                ) : belowMin ? (
                  <div className="text-[11px] font-sans" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Minimum is ₦1,000
                  </div>
                ) : (
                  <div className="text-[11px] font-sans tabular-nums" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    + {formatNaira(feeKobo, { compact: true })} AGRO fee ({feePct}%)
                    {' · '}
                    <span style={{ color: 'hsl(var(--foreground))' }}>
                      {formatNaira(totalDueKobo, { compact: true })} due at harvest
                    </span>
                  </div>
                )
              )}
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
                disabled={loading || exceedsAvailable || belowMin || amountInputKobo <= 0 || approvalBeat !== 'idle'}
                className="flex-1 rounded-xl py-3 text-sm font-semibold font-sans transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
