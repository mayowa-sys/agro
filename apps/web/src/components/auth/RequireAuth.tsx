import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';

export function RequireAuth() {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
