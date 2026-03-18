import { Outlet, Link } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="hidden bg-gradient-to-br from-brand-700 via-accent-700 to-slate-900 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-50">
            Ticket Management Suite
          </div>
          <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight">
            A service desk interface for administrators and end users.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-blue-50/85">
            Manage ticket submissions, status updates, and priority control with role-based panels.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm font-semibold">Admin workspace</p>
            <p className="mt-2 text-sm text-blue-50/80">
              View all tickets, change status, and manage priority from the operations panel.
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm font-semibold">User workspace</p>
            <p className="mt-2 text-sm text-blue-50/80">
              Create support tickets, see your submissions, and review full details in a dedicated panel.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/auth/login" className="text-lg font-bold text-slate-900">
              TicketDesk
            </Link>
            <div className="text-sm text-slate-500">Professional support UI</div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
