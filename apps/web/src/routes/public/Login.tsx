import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth.store';

export function Login() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);
  const nav = useNavigate();

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
      const { data } = await api.post('/auth/demo-login', {
        farmerId: 'cmoxgcurl0009j6vi8rxt9q7x',
      });
      login(data.token, data.user);
      nav('/app/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-ink/10 p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Agro</h1>
          <p className="text-sm text-ink/50 mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            className="w-full border border-ink/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf"
            placeholder="Phone (e.g. 08012345678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
          <input
            className="w-full border border-ink/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf"
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-leaf text-cream py-2 rounded-lg text-sm font-medium hover:bg-leaf-light transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <button
            onClick={demoLogin}
            disabled={loading}
            className="w-full border border-leaf/40 text-leaf py-2 rounded-lg text-sm font-medium hover:bg-leaf/5 transition-colors disabled:opacity-50"
          >
            Demo login as Tunde
          </button>
        )}
      </div>
    </div>
  );
}
