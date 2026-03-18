import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardShell({ title, subtitle, menuItems, activeKey, onMenuChange, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = useMemo(() => {
    const source = user?.email || user?.name || 'TM';
    return source.slice(0, 2).toUpperCase();
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/auth/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 md:p-6">
        <aside className="hidden w-80 flex-col rounded-[2rem] bg-slate-950 p-5 text-white shadow-soft lg:flex">
          <div className="rounded-3xl bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Workspace</div>
            <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
          </div>

          <nav className="mt-6 flex flex-col gap-3">
            {menuItems.map((item) => {
              const active = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onMenuChange(item.key)}
                  className={`menu-item ${active ? 'menu-item-active' : 'menu-item-inactive'}`}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-blue-50/80' : 'text-slate-500'}`}>
                    {item.description}
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold">{user?.email || 'Signed-in user'}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{user?.role || 'Role'}</p>
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="btn-secondary mt-5 w-full bg-white/90">
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden rounded-[2rem] bg-white p-4 shadow-soft md:p-6">
          <div className="mb-6 flex flex-col gap-4 rounded-[2rem] bg-gradient-to-r from-slate-950 via-brand-800 to-accent-700 p-5 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-blue-100/70">Ticket dashboard</p>
              <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm text-blue-50/80">{subtitle}</p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-blue-50/90">
              Signed in as <span className="font-semibold">{user?.role}</span>
            </div>
          </div>

          <div className="lg:hidden">
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item) => {
                const active = activeKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onMenuChange(item.key)}
                    className={`menu-item ${active ? 'menu-item-active' : 'menu-item-inactive'}`}
                  >
                    <div className="font-semibold">{item.label}</div>
                    <div className={`mt-1 text-xs ${active ? 'text-blue-50/80' : 'text-slate-500'}`}>
                      {item.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-[calc(100vh-240px)] overflow-y-auto pr-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
