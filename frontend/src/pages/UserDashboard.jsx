import { useEffect, useMemo, useState } from 'react';
import { createTicket, getMyTickets, getTicketById } from '../api/ticketApi';
import DashboardShell from '../layouts/DashboardShell';
import SectionHeader from '../components/SectionHeader';
import TicketCard from '../components/TicketCard';

const userMenu = [
  {
    key: 'create-ticket',
    label: 'Create Ticket',
    description: 'Submit a new support issue with the required fields.',
  },
  {
    key: 'view-my-tickets',
    label: 'View My Tickets',
    description: 'View your tickets.',
  },
  {
    key: 'ticket-details',
    label: 'Ticket Details Page',
    description: 'Review complete details for a selected ticket.',
  },
];

export default function UserDashboard() {
  const [activeMenu, setActiveMenu] = useState('create-ticket');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsTicket, setDetailsTicket] = useState(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', description: '', priority: 'low' });

  const currentMenu = useMemo(
    () => userMenu.find((item) => item.key === activeMenu) || userMenu[0],
    [activeMenu]
  );

  async function loadTickets() {
    setLoadingTickets(true);
    setError('');

    try {
      const data = await getMyTickets();
      setTickets(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length) {
        setSelectedTicket(data[0]);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load your tickets.');
    } finally {
      setLoadingTickets(false);
    }
  }

  useEffect(() => {
    if (activeMenu === 'view-my-tickets' || activeMenu === 'ticket-details') {
      loadTickets();
    }
    if (activeMenu !== 'ticket-details') {
      setDetailsTicket(null);
    }
    setMessage('');
  }, [activeMenu]);

  function updateField(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleCreateTicket(event) {
    event.preventDefault();
    setFormLoading(true);
    setError('');
    setMessage('');

    try {
      const created = await createTicket(form);
      setMessage('Ticket created successfully.');
      setForm({ title: '', description: '', priority: 'low' });
      setTickets((prev) => [created, ...prev]);
      setSelectedTicket(created);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create ticket.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSelectTicket(ticket) {
    setSelectedTicket(ticket);
    if (activeMenu !== 'ticket-details') return;

    setLoadingDetails(true);
    setError('');
    try {
      const data = await getTicketById(ticket.id);
      setDetailsTicket(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load ticket details.');
    } finally {
      setLoadingDetails(false);
    }
  }

  function renderTicketList() {
    if (loadingTickets) {
      return <div className="card p-6 text-sm text-slate-600">Loading your tickets...</div>;
    }

    if (!tickets.length) {
      return <div className="card p-6 text-sm text-slate-600">No tickets found yet.</div>;
    }

    return (
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            selected={selectedTicket?.id === ticket.id}
            compact
            onSelect={handleSelectTicket}
          />
        ))}
      </div>
    );
  }

  function renderContent() {
    if (activeMenu === 'create-ticket') {
      return (
        <div>
          <SectionHeader
            title="Create a new ticket"
            description="Use this form to submit a new support ticket."
          />
          <div className="card mx-auto max-w-3xl p-6">
            <form onSubmit={handleCreateTicket} className="space-y-5">
              <div>
                <label className="label" htmlFor="title">Ticket title</label>
                <input
                  id="title"
                  name="title"
                  className="input"
                  value={form.title}
                  onChange={updateField}
                  placeholder="Enter a short issue title"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="input min-h-40 resize-y"
                  value={form.description}
                  onChange={updateField}
                  placeholder="Describe the issue clearly"
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="priority">Priority</label>
                <select id="priority" name="priority" className="input" value={form.priority} onChange={updateField}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
              {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

              <button type="submit" className="btn-primary w-full" disabled={formLoading}>
                {formLoading ? 'Submitting ticket...' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        </div>
      );
    }

    if (activeMenu === 'view-my-tickets') {
      return (
        <div>
          <SectionHeader
            title="My tickets"
            description="This panel shows your personal tickets."
          />
          {error && !tickets.length ? (
            <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : null}
          {renderTicketList()}
        </div>
      );
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeader
            title="Ticket details page"
            description="Select one of your tickets from the list to load its full details in the details panel."
          />
          {renderTicketList()}
        </div>

        <div className="card p-6">
          <h3 className="text-xl font-semibold text-slate-900">Detailed view</h3>
          {loadingDetails ? <p className="mt-4 text-sm text-slate-600">Loading ticket details...</p> : null}
          {!loadingDetails && detailsTicket ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Title</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{detailsTicket.title}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Description</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{detailsTicket.description}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Status</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{detailsTicket.status}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Priority</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{detailsTicket.priority}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Ticket ID</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{detailsTicket.id}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Created at</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {detailsTicket.created_at ? new Date(detailsTicket.created_at).toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {!loadingDetails && !detailsTicket ? (
            <p className="mt-4 text-sm text-slate-600">Select a ticket to display all its details here.</p>
          ) : null}
          {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      title="User Panel"
      subtitle="Create tickets, view your own requests, and inspect full ticket details."
      menuItems={userMenu}
      activeKey={activeMenu}
      onMenuChange={setActiveMenu}
    >
      {renderContent()}
    </DashboardShell>
  );
}
