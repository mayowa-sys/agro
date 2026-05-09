import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';

export function Login() {
  const [phone, setPhone] = useState('');
  const [pin, setPin]     = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const login = useAuth((s) => s.login);
  const nav   = useNavigate();

  useEffect(() => { setMounted(true); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone, pin });
      login(data.token, data.user);
      nav(data.user.role === 'AGGREGATOR' ? '/portal/dashboard' : '/app/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/demo-login', { farmerId: 'cmoxgcurl0009j6vi8rxt9q7x' });
      login(data.token, data.user);
      nav('/app/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">

      {/* ============ LEFT — illustrated panel ============ */}
      <div className="hidden lg:flex lg:w-[55%] relative items-stretch overflow-hidden">

        {/* Sky gradient background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, #f5cb8a 0%, #e89c5f 35%, #c4724a 65%, #6b4a3a 100%)'
        }} />

        {/* Sun — pulsing glow */}
        <div className="absolute top-[18%] right-[22%] w-32 h-32">
          <div className="absolute inset-0 rounded-full bg-yellow-100 opacity-90 blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute inset-4 rounded-full bg-yellow-50" />
        </div>

        {/* Clouds — drifting */}
        <svg className="absolute top-[12%] left-[8%] opacity-60" width="120" height="40" viewBox="0 0 120 40">
          <ellipse cx="30" cy="22" rx="22" ry="10" fill="#fef9e7" />
          <ellipse cx="55" cy="20" rx="28" ry="12" fill="#fef9e7" />
          <ellipse cx="85" cy="22" rx="20" ry="9" fill="#fef9e7" />
          <animateTransform attributeName="transform" type="translate" from="0 0" to="20 0" dur="14s" repeatCount="indefinite" additive="sum" />
        </svg>
        <svg className="absolute top-[28%] left-[40%] opacity-40" width="80" height="28" viewBox="0 0 120 40">
          <ellipse cx="30" cy="22" rx="22" ry="10" fill="#fef9e7" />
          <ellipse cx="55" cy="20" rx="28" ry="12" fill="#fef9e7" />
          <ellipse cx="85" cy="22" rx="20" ry="9" fill="#fef9e7" />
          <animateTransform attributeName="transform" type="translate" from="0 0" to="-30 0" dur="22s" repeatCount="indefinite" additive="sum" />
        </svg>

        {/* Rolling hills + farm landscape */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 800 320" preserveAspectRatio="none" style={{ height: '60%' }}>
          {/* Far hill */}
          <path d="M0,180 Q200,120 400,150 T800,140 L800,320 L0,320 Z" fill="#4a6741" opacity="0.85"/>
          {/* Mid hill */}
          <path d="M0,220 Q150,170 350,200 T800,190 L800,320 L0,320 Z" fill="#3d5a35"/>
          {/* Near field with rows */}
          <path d="M0,250 Q200,230 400,245 T800,240 L800,320 L0,320 Z" fill="#2d4427"/>
          {/* Crop rows — pattern */}
          <g opacity="0.4">
            {Array.from({ length: 14 }).map((_, i) => (
              <path
                key={i}
                d={`M${-100 + i * 70},${260 + (i % 3) * 4} Q${100 + i * 70},${250 + (i % 3) * 4} ${300 + i * 70},${258 + (i % 3) * 4}`}
                stroke="#1f2e1c"
                strokeWidth="2"
                fill="none"
              />
            ))}
          </g>
        </svg>

        {/* Growing plants — sprouts at the bottom */}
        <svg className="absolute bottom-[8%] left-[15%]" width="60" height="80" viewBox="0 0 60 80">
          <line x1="30" y1="80" x2="30" y2="40" stroke="#2d4427" strokeWidth="2.5"/>
          <ellipse cx="22" cy="38" rx="10" ry="5" fill="#5b8049" transform="rotate(-30 22 38)"/>
          <ellipse cx="38" cy="32" rx="11" ry="5" fill="#6b9554" transform="rotate(35 38 32)"/>
          <ellipse cx="30" cy="22" rx="9" ry="4" fill="#7aa861"/>
        </svg>
        <svg className="absolute bottom-[6%] left-[30%]" width="50" height="65" viewBox="0 0 60 80">
          <line x1="30" y1="80" x2="30" y2="40" stroke="#2d4427" strokeWidth="2.5"/>
          <ellipse cx="20" cy="42" rx="9" ry="4" fill="#5b8049" transform="rotate(-25 20 42)"/>
          <ellipse cx="40" cy="36" rx="10" ry="4" fill="#6b9554" transform="rotate(30 40 36)"/>
        </svg>
        <svg className="absolute bottom-[7%] left-[55%]" width="55" height="72" viewBox="0 0 60 80">
          <line x1="30" y1="80" x2="30" y2="35" stroke="#2d4427" strokeWidth="2.5"/>
          <ellipse cx="22" cy="38" rx="10" ry="5" fill="#5b8049" transform="rotate(-30 22 38)"/>
          <ellipse cx="38" cy="30" rx="11" ry="5" fill="#7aa861" transform="rotate(35 38 30)"/>
          <ellipse cx="30" cy="20" rx="9" ry="4" fill="#8bb86f"/>
        </svg>

        {/* Birds — V flying across */}
        <svg className="absolute top-[22%] left-[55%]" width="100" height="40" viewBox="0 0 100 40">
          <path d="M10,20 Q15,12 20,20 Q25,12 30,20" stroke="#3d2a1e" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M40,18 Q45,10 50,18 Q55,10 60,18" stroke="#3d2a1e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
          <animateTransform attributeName="transform" type="translate" from="0 0" to="200 -20" dur="18s" repeatCount="indefinite"/>
        </svg>

        {/* Brand wordmark */}
        <div className="absolute top-10 left-12 z-10">
          <span
            className="text-4xl text-stone-900"
            style={{ fontFamily: 'Ojuju, sans-serif', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            Agro
          </span>
        </div>

        {/* Live data callouts — float in */}
        <div className={`absolute top-[28%] left-12 z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
             style={{ transitionDelay: '300ms' }}>
          <div className="bg-white/95 backdrop-blur rounded-xl shadow-xl border border-stone-200/40 px-4 py-3 max-w-[240px]">
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-sans">Next 90 days</p>
            <p className="font-display text-2xl text-stone-900 mt-0.5">+₦2.87M</p>
            <p className="text-xs text-stone-600 font-sans">expected harvest income</p>
          </div>
        </div>

        <div className={`absolute top-[48%] right-12 z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
             style={{ transitionDelay: '600ms' }}>
          <div className="bg-stone-900/90 backdrop-blur rounded-xl shadow-xl px-4 py-3 max-w-[220px]">
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-sans">Liberation counter</p>
            <p className="font-display text-2xl text-stone-100 mt-0.5">₦12.4B</p>
            <p className="text-xs text-stone-400 font-sans">freed from middlemen</p>
          </div>
        </div>

        {/* Quote at bottom */}
        <div className={`absolute bottom-12 left-12 right-12 z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
             style={{ transitionDelay: '900ms' }}>
          <blockquote className="font-display text-xl italic text-stone-900 leading-snug">
            "Plant in confidence. Harvest with foresight."
          </blockquote>
          <p className="text-xs text-stone-800/70 font-sans mt-2 uppercase tracking-widest">Built for Nigerian smallholders</p>
        </div>
      </div>

      {/* ============ RIGHT — form ============ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Texture */}
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.15) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Mobile wordmark */}
        <div className="lg:hidden mb-10 relative">
          <span
            className="text-4xl text-foreground"
            style={{ fontFamily: 'Ojuju, sans-serif', fontWeight: 300, letterSpacing: '-0.02em' }}
          >
            Agro
          </span>
        </div>

        <div className="w-full max-w-sm space-y-7 relative">
          {/* Welcome chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-leaf-500/30 bg-leaf-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse" />
            <span className="text-xs text-leaf-700 dark:text-leaf-400 font-sans font-medium">
              Sandbox · open access
            </span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="font-display text-4xl text-foreground leading-tight">
              Welcome <span className="italic">back</span>
            </h1>
            <p className="text-sm text-muted-foreground font-sans mt-2">
              Sign in to manage your harvest cash flow
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-sans font-semibold">
                Phone number
              </label>
              <input
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground font-sans placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/60 transition-all"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-sans font-semibold">
                PIN
              </label>
              <input
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground font-sans placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-leaf-500/40 focus:border-leaf-500/60 transition-all tracking-[0.5em]"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive font-sans bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group w-full bg-leaf-600 hover:bg-leaf-700 text-white py-3 rounded-lg text-sm font-semibold font-sans active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-leaf-500/20 mt-2"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Signing in…</>
                : <>Sign in <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></>
              }
            </button>
          </form>

          {/* Demo */}
          {import.meta.env.VITE_DEMO_MODE === 'true' && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest">or try the demo</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={demoLogin}
                disabled={loading}
                className="w-full border border-border bg-card hover:bg-accent py-3 rounded-lg text-sm font-medium font-sans text-foreground transition-all disabled:opacity-40 flex items-center justify-center gap-2.5"
              >
                <span className="font-display italic text-leaf-600 dark:text-leaf-400">Tunde</span>
                <span className="text-muted-foreground">→</span>
                <span>Sign in as demo farmer</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
