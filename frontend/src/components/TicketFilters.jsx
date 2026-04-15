export default function TicketFilters({
  filters,
  onChange,
  onReset,
  onApply,
  showApply = true,
  applyLabel = 'Apply Filters',
  resetLabel = 'Reset Filters',
}) {
  return (
    <div className="card mb-5 p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px, 1fr)_minmax(180px, 220px)_minmax(180px, 220px)_auto_auto]">
        <div>
          <label className="label" htmlFor="search">Search</label>
          <input
            id="search"
            className="input min-w-[180px]"
            placeholder="Search by title or keyword"
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            className="input min-w-[180px]"
            value={filters.status}
            onChange={(event) => onChange('status', event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="priorityFilter">Priority</label>
          <select
            id="priorityFilter"
            className="input min-w-[180px]"
            value={filters.priority}
            onChange={(event) => onChange('priority', event.target.value)}
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          {showApply ? (
            <button type="button" className="btn-primary whitespace-nowrap" onClick={onApply}>
              {applyLabel}
            </button>
          ) : null}
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={onReset}>
            {resetLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
