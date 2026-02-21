import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Activity, Loader2 } from 'lucide-react';

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
        setError('Invalid email or password');
      } else {
        setError('Login failed, please try again');
      }
    } catch {
      setError('Login failed, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">LucidReview</h1>
          <p className="text-xs text-slate-500">UM Criteria Engine</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nurse@hospital.org"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
