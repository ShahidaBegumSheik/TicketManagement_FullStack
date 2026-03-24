export function statusBadge(status) {
  switch (status) {
    case 'open':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'in_progress':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'closed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'cancelled':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export function priorityBadge(priority) {
  switch (priority) {
    case 'urgent':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'medium':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'low':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}
