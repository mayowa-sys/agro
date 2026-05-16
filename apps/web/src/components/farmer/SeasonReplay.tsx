import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Sprout, Banknote, Hammer, AlertTriangle,
  ArrowRight, Sparkles, CheckCircle2, Loader2, RotateCcw
} from 'lucide-react'
import { api } from '@/lib/api'

const LEAF = '#22c55e'
const LEAF_DEEP = '#15803d'
const CLAY = '#a0522d'
const GOLD = '#d97706'
const ORANGE = '#f97316'
const INK = '#fafaf9'
const INK_DIM = 'rgba(250, 250, 249, 0.55)'
const INK_FAINT = 'rgba(250, 250, 249, 0.3)'

function formatNaira(kobo: number | bigint, opts: { compact?: boolean } = {}): string {
  const n = Number(kobo) / 100
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(1) + 'M'
    if (Math.abs(n) >= 1_000) return '₦' + Math.round(n / 1_000) + 'k'
  }
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: 0 })
}

function useCountUp(target: number, duration = 1200, start = true): number {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    if (!start) return
    startTimeRef.current = null
    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, start])
  return value
}

function useCountUpFrom(start: number, target: number, duration = 1200, enabled = true): number {
  const diff = target - start
  const value = useCountUp(diff, duration, enabled)
  return start + value
}

type Projection = {
  current: {
    working: number; bills: number; nextSeason: number; adamuSavings: number; liberation: number
    asOf?: string
  }
  projected: {
    working: number; bills: number; nextSeason: number; adamuSavings: number; liberation: number
    harvestDate?: string; harvestKobo?: number
  }
  facts: {
    harvestKobo: number; wageKobo: number
    creditPrincipalKobo: number; creditFeeKobo: number
    middlemanAvoidedKobo: number; wagePremiumKobo: number
    splitRule: { workingPct: number; billsPct: number; nextSeasonPct: number }
    supplierName: string; labourerName: string; labourerTier: number
    harvestDate?: string
    harvestFromProphet?: boolean
  }
}

type Phase = 'loading' | 'act1' | 'act2' | 'act3' | 'act4' | 'act5' | 'error'

export function SeasonReplay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [data, setData] = useState<Projection | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    async function run() {
      try {
        const res = await api.get('/demo/replay/projection')
        if (cancelled) return
        setData(res.data)
        setPhase('act1'); await sleep(4500); if (cancelled) return
        setPhase('act2'); await sleep(5000); if (cancelled) return
        setPhase('act3'); await sleep(5000); if (cancelled) return
        setPhase('act4'); await sleep(8500); if (cancelled) return
        setPhase('act5')
      } catch (err: any) {
        if (!cancelled) {
          console.error('Replay error:', err)
          setError(err?.response?.data?.error || err?.message || 'Unknown error')
          setPhase('error')
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.96)' }}>
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 rounded-full p-2 transition hover:bg-white/10"
        style={{ color: INK_DIM }}
        aria-label="Close"
      >
        <X size={22} />
      </button>

      {phase !== 'loading' && phase !== 'error' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {(['act1', 'act2', 'act3', 'act4', 'act5'] as Phase[]).map((p, i) => (
            <div
              key={p}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: phase === p ? '32px' : '6px',
                background:
                  phase === p
                    ? INK
                    : (['act1', 'act2', 'act3', 'act4', 'act5'] as Phase[]).indexOf(phase) > i
                    ? 'rgba(250, 250, 249, 0.4)'
                    : 'rgba(250, 250, 249, 0.15)',
              }}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-3xl px-6">
        <AnimatePresence mode="wait">
          {phase === 'loading' && <LoadingScene key="loading" />}
          {phase === 'act1' && data && <Act1Forecast key="act1" data={data} />}
          {phase === 'act2' && data && <Act2Intervention key="act2" data={data} />}
          {phase === 'act3' && data && <Act3Labour key="act3" data={data} />}
          {phase === 'act4' && data && <Act4Harvest key="act4" data={data} />}
          {phase === 'act5' && data && <Act5Outcome key="act5" data={data} onClose={onClose} />}
          {phase === 'error' && <ErrorScene key="error" message={error ?? 'Replay failed'} onClose={onClose} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

function LoadingScene() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: INK_DIM }} />
      <p className="text-sm" style={{ color: INK_DIM }}>Preparing the season…</p>
    </motion.div>
  )
}

function Act1Forecast({ data }: { data: Projection }) {
  // Honest framing: we narrate the credit Tunde took to bridge the predicted
  // gap, not the gap depth itself (the gap is visible on the Forecast page).
  const creditDisplay = formatNaira(data.facts.creditPrincipalKobo)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6 }} className="space-y-8">
      <div className="text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: INK_DIM }}>Act One</p>
        <h2 className="font-serif text-4xl md:text-5xl leading-tight" style={{ color: INK }}>The forecast saw it coming</h2>
      </div>
      <div className="relative h-48 mx-auto max-w-2xl">
        <svg viewBox="0 0 800 200" className="w-full h-full">
          <line x1="0" y1="120" x2="800" y2="120" stroke={INK_FAINT} strokeWidth="1" strokeDasharray="4 4" />
          <motion.path d="M 0 80 L 150 70 L 280 110 L 400 165 L 520 150 L 650 90 L 800 40" fill="none" stroke={LEAF} strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, ease: 'easeOut' }} />
          <motion.path d="M 280 120 L 400 165 L 520 150 L 520 120 Z" fill={ORANGE} fillOpacity="0.25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.8 }} />
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}>
            <circle cx="400" cy="165" r="5" fill={ORANGE} />
            <line x1="400" y1="160" x2="400" y2="40" stroke={ORANGE} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 3" />
          </motion.g>
        </svg>
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }} className="flex items-center justify-center gap-2 text-center">
        <AlertTriangle size={14} style={{ color: ORANGE }} />
        <p className="text-sm" style={{ color: INK_DIM }}>May: Forecast flagged a gap before October harvest · Tunde took <span style={{ color: ORANGE, fontWeight: 600 }}>{creditDisplay} input credit</span> to bridge it</p>
      </motion.div>
    </motion.div>
  )
}

function Act2Intervention({ data }: { data: Projection }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6 }} className="space-y-8">
      <div className="text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: INK_DIM }}>Act Two</p>
        <h2 className="font-serif text-4xl md:text-5xl leading-tight" style={{ color: INK }}>Squad closed the gap</h2>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 0.5 }} className="mx-auto max-w-md rounded-2xl p-6" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: LEAF, color: '#000' }}>
            <Banknote size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: LEAF }}>Input credit approved</p>
              <CheckCircle2 size={12} style={{ color: LEAF }} />
            </div>
            <p className="font-serif text-3xl leading-none" style={{ color: INK }}>{formatNaira(data.facts.creditPrincipalKobo)}</p>
            <p className="mt-2 text-xs" style={{ color: INK_DIM }}>Fertilizer & seed advanced to <span style={{ color: INK }}>{data.facts.supplierName}</span></p>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="flex items-center justify-center gap-2 text-center">
        <Sparkles size={12} style={{ color: INK_DIM }} />
        <p className="text-xs" style={{ color: INK_DIM }}>Squad Transfer API · Instant supplier payout · Repay at harvest</p>
      </motion.div>
    </motion.div>
  )
}

function Act3Labour({ data }: { data: Projection }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6 }} className="space-y-8">
      <div className="text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: INK_DIM }}>Act Three</p>
        <h2 className="font-serif text-4xl md:text-5xl leading-tight" style={{ color: INK }}>The right worker, found</h2>
      </div>
      <div className="mx-auto max-w-2xl space-y-4">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="rounded-2xl p-5" style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
          <div className="flex items-start gap-3">
            <Sprout size={16} style={{ color: LEAF }} className="mt-1 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: LEAF }}>Tunde posted</p>
              <p className="text-sm" style={{ color: INK }}>Harvest help needed · 2 days · {formatNaira(data.facts.wageKobo)}</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex justify-center">
          <ArrowRight size={18} style={{ color: INK_FAINT }} className="rotate-90" />
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.6, duration: 0.5 }} className="rounded-2xl p-5" style={{ background: 'rgba(160, 82, 45, 0.08)', border: '1px solid rgba(160, 82, 45, 0.3)' }}>
          <div className="flex items-start gap-3">
            <Hammer size={16} style={{ color: CLAY }} className="mt-1 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: CLAY }}>{data.facts.labourerName} accepted</p>
              <p className="text-sm mb-2" style={{ color: INK }}>Tier {data.facts.labourerTier} labourer · 5.2km away · 84% skill match</p>
              <div className="flex flex-wrap gap-1.5">
                {['harvest', 'weeding'].map((s) => (
                  <span key={s} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(160, 82, 45, 0.15)', color: CLAY }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.8 }} className="text-center text-xs" style={{ color: INK_DIM }}>Semantic matching · Trust-tier filter · Distance ranking</motion.p>
    </motion.div>
  )
}

function Act4Harvest({ data }: { data: Projection }) {
  const [potsVisible, setPotsVisible] = useState(false)
  const [deferralPaid, setDeferralPaid] = useState(false)
  const [wagePaid, setWagePaid] = useState(false)
  const [libVisible, setLibVisible] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setPotsVisible(true), 1200)
    const t2 = setTimeout(() => setDeferralPaid(true), 3500)
    const t3 = setTimeout(() => setWagePaid(true), 5000)
    const t4 = setTimeout(() => setLibVisible(true), 6200)
    return () => { [t1, t2, t3, t4].forEach(clearTimeout) }
  }, [])
  const harvestAmount = useCountUp(data.facts.harvestKobo, 1500)
  // Narrative label for harvest date — relative to today so it stays accurate
  // regardless of when the seed was run.
  const harvestLabel = (() => {
    const iso = data.projected.harvestDate ?? data.facts.harvestDate
    if (!iso) return 'Harvest day'
    const target = new Date(iso)
    const now = new Date()
    const days = Math.round((target.getTime() - now.getTime()) / 86400000)
    if (days <= 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days <= 90) return `${days} days from now`
    const months = Math.round(days / 30)
    return `${months} months from now`
  })()
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }} className="space-y-6">
      <div className="text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: INK_DIM }}>Act Four · {harvestLabel}</p>
        <h2 className="font-serif text-5xl md:text-6xl leading-none tracking-tight" style={{ color: INK }}>{formatNaira(harvestAmount)}</h2>
        <p className="mt-3 text-sm" style={{ color: INK_DIM }}>Harvest sold · Cash hits Tunde's working account</p>
        {data.facts.harvestFromProphet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
            <Sparkles size={10} style={{ color: LEAF }} />
            <span className="text-[10px] font-medium tracking-wide" style={{ color: LEAF }}>Prophet model forecast</span>
          </motion.div>
        )}
      </div>
      <AnimatePresence>
        {potsVisible && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            <PotCard label="Working" start={data.current.working} target={data.projected.working} color={LEAF} delay={0} />
            <PotCard label="Bills" start={data.current.bills} target={data.projected.bills} color={GOLD} delay={150} />
            <PotCard label="Next Season" start={data.current.nextSeason} target={data.projected.nextSeason} color={LEAF_DEEP} delay={300} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-2xl mx-auto space-y-2">
        <AnimatePresence>
          {deferralPaid && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.25)' }}>
              <CheckCircle2 size={16} style={{ color: GOLD }} />
              <p className="flex-1 text-sm" style={{ color: INK }}>Input credit auto-repaid</p>
              <p className="text-sm font-semibold" style={{ color: GOLD }}>−{formatNaira(data.facts.creditPrincipalKobo + data.facts.creditFeeKobo)}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {wagePaid && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(160, 82, 45, 0.08)', border: '1px solid rgba(160, 82, 45, 0.3)' }}>
              <Hammer size={16} style={{ color: CLAY }} />
              <p className="flex-1 text-sm" style={{ color: INK }}>{data.facts.labourerName}'s wage transferred to Squad savings</p>
              <p className="text-sm font-semibold" style={{ color: CLAY }}>+{formatNaira(data.facts.wageKobo)}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {libVisible && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="mx-auto max-w-md rounded-2xl px-5 py-4 text-center" style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: GOLD }}>Liberation gained this season</p>
            <LiberationTicker before={0} after={data.facts.middlemanAvoidedKobo + data.facts.wagePremiumKobo} />
            <p className="mt-2 text-[10px]" style={{ color: INK_DIM }}>
              {formatNaira(data.facts.middlemanAvoidedKobo, { compact: true })} middleman avoided · {formatNaira(data.facts.wagePremiumKobo, { compact: true })} wage premium
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PotCard({ label, start, target, color, delay }: { label: string; start: number; target: number; color: string; delay: number }) {
  const value = useCountUpFrom(start, target, 1400, true)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay / 1000, duration: 0.4 }} className="rounded-xl p-3 text-center" style={{ background: 'rgba(250, 250, 249, 0.04)', border: '1px solid rgba(250, 250, 249, 0.1)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
      <p className="font-serif text-xl leading-none" style={{ color: INK }}>{formatNaira(value, { compact: true })}</p>
    </motion.div>
  )
}

function LiberationTicker({ before, after }: { before: number; after: number }) {
  const value = useCountUpFrom(before, after, 1800, true)
  return <p className="font-serif text-3xl leading-none" style={{ color: INK }}>{formatNaira(value)}</p>
}

function Act5Outcome({ data, onClose }: { data: Projection; onClose: () => void }) {
  const tundeTotal = data.projected.working + data.projected.bills + data.projected.nextSeason
  const liberationGain = data.facts.middlemanAvoidedKobo + data.facts.wagePremiumKobo
  const handleReplay = () => { window.location.reload() }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="space-y-10">
      <div className="text-center">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: INK_DIM }}>Act Five</p>
        <h2 className="font-serif text-4xl md:text-5xl leading-tight" style={{ color: INK }}>One transaction. Two lives.</h2>
      </div>
      <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl p-5 text-center" style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: LEAF, color: '#000' }}>
            <Sprout size={20} />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: LEAF }}>Tunde Adeyemi</p>
          <p className="text-xs mt-1 mb-3" style={{ color: INK_DIM }}>Yam farmer · Oyo</p>
          <p className="font-serif text-2xl leading-none mb-1" style={{ color: INK }}>{formatNaira(tundeTotal, { compact: true })}</p>
          <p className="text-[10px]" style={{ color: INK_DIM }}>Routed across 3 pots</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="rounded-2xl p-5 text-center" style={{ background: 'rgba(160, 82, 45, 0.08)', border: '1px solid rgba(160, 82, 45, 0.3)' }}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: CLAY, color: '#fff' }}>
            <Hammer size={20} />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: CLAY }}>{data.facts.labourerName}</p>
          <p className="text-xs mt-1 mb-3" style={{ color: INK_DIM }}>Labourer · Tier {data.facts.labourerTier}</p>
          <p className="font-serif text-2xl leading-none mb-1" style={{ color: INK }}>{formatNaira(data.projected.adamuSavings, { compact: true })}</p>
          <p className="text-[10px]" style={{ color: INK_DIM }}>Squad savings deposit</p>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }} className="text-center">
        <p className="text-sm" style={{ color: INK_DIM }}>Five Squad endpoints · One harvest cycle · <span style={{ color: GOLD }}>{formatNaira(liberationGain, { compact: true })} liberation captured</span></p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="flex items-center justify-center gap-3">
        <button onClick={handleReplay} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition hover:opacity-90" style={{ background: 'rgba(250, 250, 249, 0.1)', color: INK, border: '1px solid rgba(250, 250, 249, 0.2)' }}>
          <RotateCcw size={14} />
          Watch again
        </button>
        <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-medium transition hover:opacity-90" style={{ background: INK, color: '#000' }}>Close</button>
      </motion.div>
    </motion.div>
  )
}

function ErrorScene({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 max-w-md mx-auto">
      <AlertTriangle size={32} style={{ color: ORANGE }} className="mx-auto" />
      <h2 className="font-serif text-2xl" style={{ color: INK }}>Replay couldn't run</h2>
      <p className="text-sm" style={{ color: INK_DIM }}>{message}</p>
      <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-medium" style={{ background: INK, color: '#000' }}>Close</button>
    </motion.div>
  )
}
