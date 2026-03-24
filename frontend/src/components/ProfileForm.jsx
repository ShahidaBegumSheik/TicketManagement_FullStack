import { useState } from 'react';

export default function ProfileForm({ user, onSave }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleChange(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await onSave(form);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card max-w-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" className="input" value={form.name} onChange={handleChange} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" value={form.email} onChange={handleChange} required />
        </div>
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
