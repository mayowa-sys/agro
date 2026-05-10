import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth.store';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireRole } from '@/components/auth/RequireRole';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/routes/public/Login';
import Dashboard from '@/routes/farmer/Dashboard';
import Forecast from '@/routes/farmer/Forecast';
import SplitRules from '@/routes/farmer/SplitRules';
import Deferrals from '@/routes/farmer/Deferrals';
import Jobs from '@/routes/farmer/Jobs'

export function App() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireRole role="FARMER" />}>
            <Route path="/app" element={<AppShell />}>
              <Route path="dashboard" element={<Dashboard />} />
              {/* Mayowa's pages — uncomment as each is built */}
               <Route path="forecast" element={<Forecast />} />
               <Route path="splits" element={<SplitRules />} />
               <Route path="deferrals" element={<Deferrals />} />
                <Route path="jobs" element={<Jobs />} />
              {/* <Route path="season-replay" element={<SeasonReplay />} /> */}
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
