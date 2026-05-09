import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';

export function RequireRole({ role }: { role: 'FARMER' | 'AGGREGATOR' | 'ADMIN' }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
