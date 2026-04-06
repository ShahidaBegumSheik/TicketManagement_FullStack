export default function EmptyState({ text = 'No data available.' }) {
  return <div className="card p-8 text-center text-sm text-slate-500">{text}</div>;
}
