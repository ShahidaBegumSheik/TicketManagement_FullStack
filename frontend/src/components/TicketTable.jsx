function getTypeBadge(ticket, referenceUserId) {
  if (!referenceUserId) return null;

  if (ticket.user_id === referenceUserId && ticket.assigned_user_id === referenceUserId) {
    return (
      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
        Created & Assigned
      </span>
    );
  }

  if (ticket.user_id === referenceUserId) {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        Created
      </span>
    );
  }

  if (ticket.assigned_user_id === referenceUserId) {
    return (
      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
        Assigned
      </span>
    );
  }

  return <span className="text-slate-400">—</span>;
}

export default function TicketTable({
  tickets,
  loading = false,
  emptyText = 'No tickets found.',
  referenceUserId = null,
  showType = false,
  showActions = false,
  onView,
  actionLabel = 'View',
}) {
  if (loading) {
    return <div className="card p-6 text-sm text-slate-600">Loading tickets...</div>;
  }

  if (!tickets.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="card p-4 overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            {showType ? <th className="px-4 py-3">Type</th> : null}
            <th className="px-4 py-3">Created</th>
            {showActions ? <th className="px-4 py-3">Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-b hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{ticket.title}</td>
              <td className="px-4 py-3">{ticket.status}</td>
              <td className="px-4 py-3">{ticket.priority}</td>
              {showType ? (
                <td className="px-4 py-3">{getTypeBadge(ticket, referenceUserId)}</td>
              ) : null}
              <td className="px-4 py-3">{new Date(ticket.created_at).toLocaleString()}</td>
              {showActions ? (
                <td className="px-4 py-3">
                  <button type="button" className="btn-secondary" onClick={() => onView?.(ticket)}>
                    {actionLabel}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
