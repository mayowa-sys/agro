import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';

export function RequireRole({ role }: { role: 'FARMER' | 'AGGREGATOR' | 'ADMIN' | 'LABOURER' }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== role) {
    // Stale user – clear everything and re‑authenticate
    logout();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}