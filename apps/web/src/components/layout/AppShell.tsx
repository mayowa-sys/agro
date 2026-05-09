import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';

const farmerLinks = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/forecast', label: 'Forecast' },
  { to: '/app/splits', label: 'Splits' },
  { to: '/app/deferrals', label: 'Deferrals' },
  { to: '/app/season-replay', label: 'Season Replay' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <header className="border-b border-ink/10 px-6 py-3 flex items-center justify-between bg-leaf">
        <span className="font-bold text-lg text-cream tracking-tight">Agro</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-cream/70">{user?.phone}</span>
          <button
            onClick={logout}
            className="text-cream/70 hover:text-cream transition-colors"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-52 border-r border-ink/10 p-4 hidden md:block bg-white">
          <ul className="space-y-1">
            {farmerLinks.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-leaf text-cream'
                        : 'text-ink/70 hover:bg-cream hover:text-ink'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
