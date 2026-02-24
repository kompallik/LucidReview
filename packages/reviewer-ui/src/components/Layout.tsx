import { useState } from 'react';
import { Outlet, NavLink, Navigate, useLocation, useNavigate } from 'react-router';
import { ClipboardList, BookOpen, User, LogOut, SearchCheck, Stethoscope, Info, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn.ts';
import { isAuthenticated, getUser, logout } from '../pages/Login.tsx';

const ABOUT_URL = 'https://kompallik.github.io/LucidReview/';

function AboutModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Info size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">About LucidReview</span>
            <span className="text-[11px] text-slate-400 font-mono ml-1">{ABOUT_URL}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* iframe */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <span className="text-sm text-slate-500">Loading…</span>
              </div>
            </div>
          )}
          <iframe
            src={ABOUT_URL}
            title="About LucidReview"
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/reviews', label: 'Reviews', icon: ClipboardList },
  { to: '/policies', label: 'Policies', icon: BookOpen },
  { to: '/coverage-check', label: 'Coverage Check', icon: SearchCheck },
  { to: '/case-review', label: 'Case Review', icon: Stethoscope },
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
  const [showAbout, setShowAbout] = useState(false);

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
          <img src="/favicon.png" alt="LucidReview" className="h-8 w-8 rounded-lg object-cover" />
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
        <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-6">
          <Breadcrumb />
          <button
            onClick={() => setShowAbout(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            <Info size={13} />
            About
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}
