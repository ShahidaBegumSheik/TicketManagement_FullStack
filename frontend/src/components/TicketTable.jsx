import { statusBadge, priorityBadge } from "../utils/statusStyles";
import TagList from './TagList'

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
  onAction,
  actionLabel = 'View',
  meta = null,
  onPageChange,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
}) {
  if (loading) {
    return <div className="card p-6 text-sm text-slate-600">Loading tickets...</div>;
  }

  if (!tickets.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.total_pages ?? 1;
  const totalItems = meta?.total ?? tickets.length;
  const allSelected = selectable && tickets.length > 0 && tickets.every((ticket) => selectedIds.includes(ticket.id));

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto p-4">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-slate-100 text-slate-600">
            <tr>
              {selectable ? (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => onToggleSelectAll?.(event.target.checked, tickets)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </th>
              ) : null }
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Tags</th> 
              {showType ? <th className="px-4 py-3">Type</th> : null}
              <th className="px-4 py-3">Created</th>
              {showActions ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const isSelected = selectedIds.includes(ticket.id);
              return (
                <tr key={ticket.id}
                  className={`border-b hover:bg-slate-100 ${onView ? 'cursor-pointer' : ''}`}
                  onClick={onView? () => onView(ticket) : undefined}
                >
                  {selectable ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => onToggleSelect?.(ticket.id, event.target.checked)}
                        onClick={(event) => { 
                          event.stopPropagation();
                        }}
                      />
                    </td>
                  ) : null }
                <td className="px-4 py-3 font-medium text-slate-900">{ticket.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${statusBadge(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${priorityBadge(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <TagList tags={ticket.tags || []} emptyText="—" />
                </td>

                {showType ? (
                  <td className="px-4 py-3">{getTypeBadge(ticket, referenceUserId)}</td>
                ) : null}
                <td className="px-4 py-3">
                  {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}
                </td>
                {showActions ? (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                      onClick={(event) => {
                        event.stopPropagation();
                        console.log('Restore clicked for ticket:', ticket.id);
                        onAction?.(ticket.id, ticket);
                      }}
                    >
                      {actionLabel}
                    </button>
                  </td>
                ) : null}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Page <span className="font-semibold">{currentPage}</span> of{' '}
            <span className="font-semibold">{totalPages}</span> • Total tickets:{' '}
            <span className="font-semibold">{totalItems}</span>
          </p>


          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => onPageChange?.(currentPage - 1)}
            >
              Previous
            </button>


            <button
              type="button"
              className="btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange?.(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}