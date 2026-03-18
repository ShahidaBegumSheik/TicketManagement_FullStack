export default function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="card flex items-center gap-3 px-6 py-5">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <span className="text-sm font-medium text-slate-700">Loading workspace...</span>
      </div>
    </div>
  );
}
