export default function ActivityTimeline({ items = [] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-lg font-semibold text-slate-900">Activity timeline</h4>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-sm text-slate-700">{item.message}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No activity yet.</p>
        )}
      </div>
    </div>
  );
}
