import { useState } from 'react'
import { RefreshCw, Zap } from 'lucide-react'
import { api } from '@/lib/api'

const DEMO_TOKEN = import.meta.env.VITE_DEMO_TOKEN as string

export function DemoControls() {
  if (!import.meta.env.DEV) return null

  const [seeding, setSeeding] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const reseed = async () => {
    setSeeding(true); setMsg(null)
    try {
      await api.post('/demo/seed-tunde', {}, {
        headers: { 'x-demo-token': DEMO_TOKEN },
      })
      setMsg('Re‑seeded ✓')
      setTimeout(() => setMsg(null), 2000)
    } catch { setMsg('Re‑seed failed') }
    finally { setSeeding(false) }
  }

  const simulate = async () => {
    setSimulating(true); setMsg(null)
    try {
      const { data: auth } = await api.post('/auth/demo-login', { phone: '08012345678' })
      const { data: dash } = await api.get('/accounts/dashboard', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      const working = dash.accounts.find((a: any) => a.purpose === 'WORKING')
      await api.post('/demo/simulate-payment', {
        accountNumber: working.squadAccountNumber,
        amount: 20000000,
      }, { headers: { 'x-demo-token': DEMO_TOKEN } })
      setMsg('Harvest simulated ✓')
      setTimeout(() => setMsg(null), 2000)
    } catch { setMsg('Simulate failed') }
    finally { setSimulating(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={reseed}
        disabled={seeding}
        className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw size={12} className={seeding ? 'animate-spin' : ''} />
        Re‑seed
      </button>
      <button
        onClick={simulate}
        disabled={simulating}
        className="flex items-center gap-1 rounded-full border border-leaf-500/30 bg-leaf-500/10 px-3 py-1.5 text-[11px] font-semibold text-leaf-600 dark:text-leaf-400 hover:bg-leaf-500/20 transition-colors"
      >
        <Zap size={12} />
        Simulate harvest
      </button>
      {msg && (
        <span className="text-[10px] font-medium text-muted-foreground animate-in fade-in">
          {msg}
        </span>
      )}
    </div>
  )
}
