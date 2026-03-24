import { useEffect, useMemo, useState } from 'react';
import {
  addTicketComment,
  createTicket,
  getMyTickets,
  getTicketById,
  getTicketComments,
} from '../api/ticketApi';
import CommentsPanel from '../components/CommentsPanel';
import ProfileForm from '../components/ProfileForm';
import SectionHeader from '../components/SectionHeader';
import TicketFilters from '../components/TicketFilters';
import TicketTable from '../components/TicketTable';
import { useAuth } from '../contexts/AuthContext';
import DashboardShell from '../layouts/DashboardShell';

const defaultFilters = { search: '', status: '', priority: '' };

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
  {
    key: 'profile',
    label: 'My Profile',
    description: 'Update your basic account details.',
  },
];

export default function UserDashboard() {
  const { saveProfile, user } = useAuth();
  const [activeMenu, setActiveMenu] = useState('create-ticket');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsTicket, setDetailsTicket] = useState(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [form, setForm] = useState({ title: '', description: '', priority: 'low' });

  const currentMenu = useMemo(
    () => userMenu.find((item) => item.key === activeMenu) || userMenu[0],
    [activeMenu]
  );

  async function loadTickets(customFilters = filters) {
    setLoadingTickets(true);
    setError('');

    try {
      const params = Object.fromEntries(Object.entries(customFilters).filter(([, value]) => value));
      const data = await getMyTickets(params);
      setTickets(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length) {
        setSelectedTicket(data[0]);
      } else {
        setSelectedTicket(null);
        setDetailsTicket(null);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load your tickets.');
    } finally {
      setLoadingTickets(false);
    }
  }

  function updateField(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function applyFilters() {
    await loadTickets(filters);
  }

  async function resetFilters() {
    setFilters(defaultFilters);
    await loadTickets(defaultFilters);
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

  async function loadComments(ticketId) {
    setLoadingComments(true);
    try {
      const data = await getTicketComments(ticketId);
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load comments.');
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment() {
    if (!detailsTicket || !commentText.trim()) return;

    setCommentSaving(true);
    setError('');
    try {
      const created = await addTicketComment(detailsTicket.id, { content: commentText.trim() });
      setComments((prev) => [...prev, created]);
      setCommentText('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add comment.');
    } finally {
      setCommentSaving(false);
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

  useEffect(() => {
    if (detailsTicket?.id) {
      loadComments(detailsTicket.id);
    } else {
      setComments([]);
      setCommentText('');
    }
  }, [detailsTicket]);

  function renderContent() {
    if (activeMenu === 'create-ticket') {
      return (
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
                className="input min-h-36 resize-none"
                value={form.description}
                onChange={updateField}
                placeholder="Describe the issue in detail"
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="priority">Priority</label>
              <select id="priority" name="priority" className="input" value={form.priority} onChange={updateField}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

            <button type="submit" className="btn-primary w-full" disabled={formLoading}>
              {formLoading ? 'Submitting ticket...' : 'Submit Ticket'}
            </button>
          </form>
        </div>
      );
    }

    if (activeMenu === 'view-my-tickets') {
      return (
        <div>
          <TicketFilters
            filters={filters}
            onChange={updateFilter}
            onReset={resetFilters}
            onApply={applyFilters}
          />
          {error && !tickets.length ? (
            <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : null}
          <TicketTable
            tickets={tickets}
            loading={loadingTickets}
            emptyText="No tickets found."
            referenceUserId={user?.id}
            showType={true}
            showActions={false}
          />
        </div>
      );
    }

    if (activeMenu === 'profile') {
      return <ProfileForm user={user} onSave={saveProfile} />;
    }

    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div>
          <TicketFilters
            filters={filters}
            onChange={updateFilter}
            onReset={resetFilters}
            onApply={applyFilters}
          />
          {error && !tickets.length ? (
            <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : null}
          <TicketTable
            tickets={tickets}
            loading={loadingTickets}
            emptyText="No tickets found."
            referenceUserId={user?.id}
            showType={true}
            showActions={true}
            onView={handleSelectTicket}
          />
        </div>

        <div className="card p-6">
          <h3 className="text-xl font-semibold text-slate-900">Detailed view</h3>
          {loadingDetails ? (
            <p className="mt-4 text-sm text-slate-600">Loading ticket details...</p>
          ) : detailsTicket ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Title</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{detailsTicket.title}</p>
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
                  <p className="text-sm font-medium text-slate-500">Created by</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{detailsTicket.user_name || 'Unknown'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Assigned user</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{detailsTicket.assigned_user_name || 'Not assigned'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Created at</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {detailsTicket.created_at ? new Date(detailsTicket.created_at).toLocaleString() : '—'}
                  </p>
                </div>
              </div>

              <CommentsPanel
                comments={comments}
                commentText={commentText}
                onCommentChange={(event) => setCommentText(event.target.value)}
                onAddComment={handleAddComment}
                loadingComments={loadingComments}
                commentSaving={commentSaving}
                textareaId="userComment"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Select a ticket from the list to view its details.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      title="User Dashboard"
      subtitle="Create tickets, track your requests, and view assigned tickets."
      menuItems={userMenu}
      activeKey={activeMenu}
      onMenuChange={setActiveMenu}
    >
      <SectionHeader title={currentMenu.label} description={currentMenu.description} />
      {renderContent()}
    </DashboardShell>
  );
}
