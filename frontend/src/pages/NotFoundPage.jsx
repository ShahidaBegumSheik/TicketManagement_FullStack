import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="card max-w-lg p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">The page you requested does not exist in this frontend workspace.</p>
        <Link to="/auth/login" className="btn-primary mt-6 inline-flex">
          Go to login
        </Link>
      </div>
    </div>
  );
}
