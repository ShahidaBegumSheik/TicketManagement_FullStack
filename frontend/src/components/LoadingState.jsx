export default function LoadingState({ text = 'Loading...' }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      <p className="mt-4 text-sm text-slate-600">{text}</p>
    </div>
  );
}
