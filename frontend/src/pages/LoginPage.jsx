import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateField(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await login(form);
      navigate(user.role === 'admin' ? '/admin' : '/user', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Login to access the correct ticket panel for your role.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={updateField} className="input" placeholder="you@example.com" required />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" value={form.password} onChange={updateField} className="input" placeholder="Enter your password" required />
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Need an account?{' '}
          <Link to="/auth/register" className="font-semibold text-brand-700 hover:text-brand-800">
            Register here
          </Link>
        </p>
      </form>
    </div>
  );
}
