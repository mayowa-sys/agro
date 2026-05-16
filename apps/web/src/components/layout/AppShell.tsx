import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';
import { useTheme } from '@/hooks/useTheme';
import { DemoControls } from '@/components/dev/DemoControls';
import { Sun, Moon, LayoutDashboard, TrendingUp, SplitSquareHorizontal, Clock, PlayCircle, Hammer } from 'lucide-react';

const farmerLinks = [
  { to: '/app/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/app/forecast',      label: 'Forecast',      icon: TrendingUp },
  { to: '/app/splits',        label: 'Splits',        icon: SplitSquareHorizontal },
  { to: '/app/deferrals',     label: 'Input Credit',  icon: Clock },
  { to: '/app/jobs',          label: 'Jobs',          icon: Hammer },
];

const labourerLinks = [
  { to: '/app/labourer/dashboard', label: 'Dashboard', icon: Hammer },
];

const aggregatorLinks = [
  { to: '/app/portal/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const links = user?.role === 'LABOURER' ? labourerLinks
      : user?.role === 'AGGREGATOR' ? aggregatorLinks
          : farmerLinks;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <span
          className="text-2xl tracking-tight text-foreground"
          style={{ fontFamily: 'Ojuju, sans-serif', fontWeight: 700 }}
        >
          Agro
        </span>
        <div className="flex items-center gap-5">
          <span className="text-sm text-muted-foreground font-sans">{user?.phone}</span>
          <DemoControls />
          <button
            onClick={toggle}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={logout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors font-sans"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-56 border-r border-border p-3 hidden md:flex flex-col gap-0.5 shrink-0 bg-background">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 font-sans ${
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} className={isActive ? 'text-leaf-500' : 'text-muted-foreground'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
