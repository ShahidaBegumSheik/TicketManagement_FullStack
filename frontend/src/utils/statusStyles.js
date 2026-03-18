export function statusBadge(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'open') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'closed') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (value === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';

  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function priorityBadge(priority) {
  const value = String(priority || '').toLowerCase();

  if (value === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (value === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
}
