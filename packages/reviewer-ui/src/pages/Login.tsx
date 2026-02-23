import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, ShieldCheck, Brain, Zap } from 'lucide-react';

export function isAuthenticated(): boolean {
  return localStorage.getItem('lucidreview_token') !== null;
}

export function getUser(): { id: string; email: string; name: string; role: string } | null {
  const raw = localStorage.getItem('lucidreview_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('lucidreview_token');
  localStorage.removeItem('lucidreview_user');
}

const FEATURE_BULLETS = [
  {
    icon: Brain,
    title: 'AI-Powered Clinical Analysis',
    body: 'Multi-step agent autonomously reviews case evidence against CMS and payer criteria.',
  },
  {
    icon: ShieldCheck,
    title: 'Real-Time Criteria Evaluation',
    body: 'Decision trees built from live policy libraries, evaluated against FHIR clinical data.',
  },
  {
    icon: Zap,
    title: 'Instant Determinations',
    body: 'Auto-approve, deny, or escalate with full evidence trails and HIPAA-compliant audit logs.',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('lucidreview_token', data.token);
        localStorage.setItem('lucidreview_user', JSON.stringify(data.user));
        navigate('/reviews', { replace: true });
      } else if (response.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } catch {
      setError('Unable to connect. Please check your network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — branding ──────────────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-12 lg:flex">
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Radial glow */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/favicon.png" alt="LucidReview" className="mb-3 h-14 w-14 rounded-xl object-cover shadow-sm" />
          <div>
            <div className="text-base font-bold text-white">LucidReview</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-blue-300/70">
              UM Criteria Engine
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Intelligent<br />
            <span className="text-blue-400">Utilization</span><br />
            Management
          </h1>
          <p className="mt-4 max-w-sm text-base text-slate-400 leading-relaxed">
            AI-assisted prior authorization reviews with real-time clinical evidence analysis
            and transparent decision support.
          </p>

          <div className="mt-10 space-y-5">
            {FEATURE_BULLETS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
                  <Icon size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer notice */}
        <div className="relative z-10">
          <p className="text-[11px] text-slate-500">
            HIPAA-compliant · SOC 2 Type II · HL7 FHIR R4
          </p>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-8 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <img src="/favicon.png" alt="LucidReview" className="h-10 w-10 rounded-xl object-cover shadow-sm" />
          <div className="text-base font-bold text-slate-900">LucidReview</div>
        </div>

        <div className="w-full max-w-[380px] animate-fade-up">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to your clinical review workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 animate-fade-in">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-[10px] font-bold text-red-600">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="clinician@hospital.org"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <a href="#" className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline">
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-center text-[11px] text-slate-400">
              Protected by enterprise SSO · HIPAA compliant access controls
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
