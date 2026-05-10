import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { useOnboardLabourer } from '@/hooks/useLabourer'
import { useNavigate } from 'react-router-dom'

const SKILLS = ['harvest', 'weeding', 'planting', 'land_preparation', 'pesticide_application', 'irrigation', 'sorting', 'loading']
const LANGUAGES = ['HAUSA', 'IGBO', 'YORUBA', 'PIDGIN', 'EN']

export default function Onboard() {
  const [fullName, setFullName] = useState('')
  const [region, setRegion] = useState('')
  const [state, setState] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [error, setError] = useState('')
  const onboard = useOnboardLabourer()
  const navigate = useNavigate()

  function toggle(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  async function handleSubmit() {
    if (!fullName || !region || !state || !skills.length) {
      setError('Please fill in all required fields and select at least one skill.')
      return
    }
    try {
      await onboard.mutateAsync({ fullName, region, state, skills, spokenLanguages: languages })
      navigate('/app/labourer/dashboard')
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create profile.')
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'hsl(22 63% 44% / 0.12)' }}>
          <Hammer className="h-5 w-5" style={{ color: 'hsl(22 63% 44%)' }} />
        </div>
        <div>
          <h1 className="font-serif text-2xl" style={{ color: 'hsl(var(--foreground))' }}>Create your profile</h1>
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Get matched to farm work near you
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
            Full name *
          </label>
          <input className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            placeholder="e.g. Adamu Bello"
            value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
              Region *
            </label>
            <input className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              placeholder="e.g. Benue"
              value={region} onChange={e => setRegion(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--foreground))' }}>
              State *
            </label>
            <input className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              placeholder="e.g. Benue State"
              value={state} onChange={e => setState(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'hsl(var(--foreground))' }}>
            Skills * <span style={{ color: 'hsl(var(--muted-foreground))' }}>(pick all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map(skill => {
              const active = skills.includes(skill)
              return (
                <button key={skill} onClick={() => toggle(skills, setSkills, skill)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'hsl(22 63% 44%)' : 'hsl(var(--muted))',
                    color: active ? '#fff' : 'hsl(var(--muted-foreground))',
                    border: '1px solid',
                    borderColor: active ? 'hsl(22 63% 44%)' : 'hsl(var(--border))',
                  }}>
                  {skill.replace(/_/g, ' ')}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'hsl(var(--foreground))' }}>
            Languages spoken <span style={{ color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(lang => {
              const active = languages.includes(lang)
              return (
                <button key={lang} onClick={() => toggle(languages, setLanguages, lang)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'hsl(22 63% 44%)' : 'hsl(var(--muted))',
                    color: active ? '#fff' : 'hsl(var(--muted-foreground))',
                    border: '1px solid',
                    borderColor: active ? 'hsl(22 63% 44%)' : 'hsl(var(--border))',
                  }}>
                  {lang}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>
        )}

        <button
          className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'hsl(22 63% 44%)', color: '#fff' }}
          disabled={onboard.isPending}
          onClick={handleSubmit}>
          {onboard.isPending ? 'Creating profile…' : 'Create profile →'}
        </button>
      </div>
    </div>
  )
}
