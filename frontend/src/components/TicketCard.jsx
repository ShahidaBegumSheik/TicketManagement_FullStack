import { priorityBadge, statusBadge } from '../utils/statusStyles';

export default function TicketCard({ ticket, onSelect, selected = false, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket)}
      className={`w-full rounded-3xl border p-5 text-left transition ${
        selected
          ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-100'
          : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-900">{ticket.title}</p>
          <p className={`mt-2 text-sm ${compact ? 'line-clamp-2' : ''} text-slate-600`}>
            {ticket.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(ticket.status)}`}>
            {String(ticket.status).replace('_', ' ')}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadge(ticket.priority)}`}>
            {ticket.priority} priority
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span>Ticket ID: {ticket.id}</span>
        <span>User ID: {ticket.user_id}</span>
        <span>Created: {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}</span>
      </div>
    </button>
  );
}
