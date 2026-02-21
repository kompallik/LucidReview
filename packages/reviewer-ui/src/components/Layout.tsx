import { Outlet, NavLink, Navigate, useLocation, useNavigate } from 'react-router';
import { ClipboardList, BookOpen, Activity, User, LogOut, SearchCheck } from 'lucide-react';
import { cn } from '../lib/cn.ts';
import { isAuthenticated, getUser, logout } from '../pages/Login.tsx';

const NAV_ITEMS = [
  { to: '/reviews', label: 'Reviews', icon: ClipboardList },
  { to: '/policies', label: 'Policies', icon: BookOpen },
  { to: '/coverage-check', label: 'Coverage Check', icon: SearchCheck },
];

function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500">
      <span className="text-slate-400">LucidReview</span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="text-slate-300">/</span>
          <span className={i === segments.length - 1 ? 'text-slate-700 font-medium' : ''}>
            {seg.charAt(0).toUpperCase() + seg.slice(1)}
          </span>
        </span>
      ))}
    </nav>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">LucidReview</div>
            <div className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">UM Criteria Engine</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200">
              <User size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-700">
                {user?.email?.split('@')[0] ?? 'Reviewer'}
              </div>
              <div className="truncate text-[10px] text-slate-400">
                {user?.email ?? ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 items-center border-b border-slate-200 bg-white px-6">
          <Breadcrumb />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
