import { useEffect, useMemo, useState } from 'react';
import { getAllUsers, toggleUserStatus } from '../api/authApi';
import {
  addTicketComment,
  getAllTickets,
  getDashboardStats,
  getTicketComments,
  getTicketsByUser,
  updateTicket,
} from '../api/ticketApi';
import CommentsPanel from '../components/CommentsPanel';
import ProfileForm from '../components/ProfileForm';
import SectionHeader from '../components/SectionHeader';
import StatsCard from '../components/StatsCard';
import TicketFilters from '../components/TicketFilters';
import TicketTable from '../components/TicketTable';
import { useAuth } from '../contexts/AuthContext';
import DashboardShell from '../layouts/DashboardShell';

const defaultFilters = { search: '', status: '', priority: '' };

const adminMenu = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Review ticket statistics and backlog health.',
  },
  {
    key: 'view-all',
    label: 'View All Tickets',
    description: 'Search, filter, and inspect all tickets.',
  },
  {
    key: 'manage-tickets',
    label: 'Manage Tickets',
    description: 'Update ticket status, priority, and assignment.',
  },
  {
    key: 'view-users',
    label: 'Manage Users',
    description: 'View users and activate or deactivate accounts.',
  },
  {
    key: 'profile',
    label: 'My Profile',
    description: 'Update your own basic account details.',
  },
];

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statusValue, setStatusValue] = useState('open');
  const [priorityValue, setPriorityValue] = useState('low');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [userTickets, setUserTickets] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const { saveProfile, user } = useAuth();

  const currentMenu = useMemo(
    () => adminMenu.find((item) => item.key === activeMenu) || adminMenu[0],
    [activeMenu]
  );

  const assignableUsers = useMemo(
    () => users.filter((item) => item.role === 'user' && item.is_active),
    [users]
  );

  async function loadTickets(customFilters = filters) {
    setLoading(true);
    setError('');

    try {
      const params = Object.fromEntries(Object.entries(customFilters).filter(([, value]) => value));
      const data = await getAllTickets(params);
      setTickets(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length) {
        const first = data[0];
        setSelectedTicket(first);
        setStatusValue(first.status || 'open');
        setPriorityValue(first.priority || 'low');
        setAssignedUserId(first.assigned_user_id ? String(first.assigned_user_id) : '');
      } else {
        setSelectedTicket(null);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load tickets.');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load users');
    }
  }

  async function loadUserTickets(userId) {
    try {
      const data = await getTicketsByUser(userId);
      setUserTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load user tickets');
    }
  }

  async function loadStats() {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError('Failed to load dashboard statistics.');
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
    if (!selectedTicket || !commentText.trim()) return;

    setCommentSaving(true);
    setError('');
    try {
      const created = await addTicketComment(selectedTicket.id, {
        content: commentText.trim(),
      });
      setComments((prev) => [...prev, created]);
      setCommentText('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add comment.');
    } finally {
      setCommentSaving(false);
    }
  }

  useEffect(() => {
    if (activeMenu === 'dashboard') {
      loadStats();
      loadUsers();
    }
    if (activeMenu === 'view-all' || activeMenu === 'manage-tickets') {
      loadTickets();
      loadUsers();
    }
    if (activeMenu === 'view-users') {
      loadUsers();
    }
    setMessage('');
    setError('');
  }, [activeMenu]);

  useEffect(() => {
    setMessage('');
    if (selectedTicket) {
      setStatusValue(selectedTicket.status || 'open');
      setPriorityValue(selectedTicket.priority || 'low');
      setAssignedUserId(selectedTicket.assigned_user_id ? String(selectedTicket.assigned_user_id) : '');
    }
  }, [activeMenu, selectedTicket]);

  useEffect(() => {
    if (activeMenu === 'manage-tickets' && selectedTicket?.id) {
      loadComments(selectedTicket.id);
    } else {
      setComments([]);
      setCommentText('');
    }
  }, [activeMenu, selectedTicket]);

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

  async function handleTicketUpdate(event) {
    event.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        status: statusValue,
        priority: priorityValue,
      };
      if (assignedUserId) {
        payload.assigned_user_id = Number(assignedUserId);
      }
      const updated = await updateTicket(selectedTicket.id, payload);
      setMessage('Ticket updated successfully.');
      setTickets((prev) => prev.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
      setSelectedTicket(updated);
      setStatusValue(updated.status || 'open');
      setPriorityValue(updated.priority || 'low');
      setAssignedUserId(updated.assigned_user_id ? String(updated.assigned_user_id) : '');
      loadStats();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update ticket.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUserToggle(targetUser) {
    setError('');
    setMessage('');
    try {
      const updated = await toggleUserStatus(targetUser.id, !targetUser.is_active);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(`User ${updated.is_active ? 'activated' : 'deactivated'} successfully.`);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update user status.');
    }
  }

  function renderUserList() {
    if (!users.length) {
      return <p className="text-sm text-slate-500">No users found.</p>;
    }

    return (
      <div className="space-y-4">
        {users.map((entry) => (
          <div key={entry.id} className="card p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-base font-semibold text-slate-900">{entry.name}</p>
                <p className="text-sm text-slate-600">{entry.email}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {entry.role} • {entry.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(entry);
                    loadUserTickets(entry.id);
                    setActiveMenu('user-tickets');
                  }}
                  className="btn-secondary"
                >
                  View tickets
                </button>
                <button
                  type="button"
                  onClick={() => handleUserToggle(entry)}
                  className="btn-primary"
                >
                  {entry.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderUserTickets() {
    if (!selectedUser) {
      return <p>No user selected</p>;
    }

    const createdCount = userTickets.filter((ticket) => ticket.user_id === selectedUser.id).length;
    const assignedCount = userTickets.filter((ticket) => ticket.assigned_user_id === selectedUser.id).length;

    let subtitle = 'No tickets available';
    if (createdCount && assignedCount) {
      subtitle = `Tickets related to ${selectedUser.name}`;
    } else if (createdCount) {
      subtitle = `Tickets created by ${selectedUser.name}`;
    } else if (assignedCount) {
      subtitle = `Tickets assigned to ${selectedUser.name}`;
    }

    return (
      <div>
        <SectionHeader
          title={`Tickets for ${selectedUser.name}`}
          description={subtitle}
        />

        <TicketTable
          tickets={userTickets}
          loading={false}
          emptyText="No tickets found"
          referenceUserId={selectedUser.id}
          showType={true}
          showActions={false}
        />

        <button onClick={() => setActiveMenu('view-users')} className="btn-secondary mt-4">
          Back to Users
        </button>
      </div>
    );
  }

  function renderDashboard() {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatsCard label="Total tickets" value={stats?.total_tickets ?? 0} />
          <StatsCard label="Open tickets" value={stats?.open_tickets ?? 0} />
          <StatsCard label="In progress tickets" value={stats?.in_progress_tickets ?? 0} />
          <StatsCard label="Closed tickets" value={stats?.closed_tickets ?? 0} />
          <StatsCard label="Cancelled tickets" value={stats?.cancelled_tickets ?? 0} />
          <StatsCard label="Active users" value={users.filter((entry) => entry.is_active).length} />
        </div>

        <div>
          <SectionHeader title="Priority distribution" description="Quick view of backlog urgency." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard label="Urgent" value={stats?.urgent_tickets ?? 0} />
            <StatsCard label="High" value={stats?.high_tickets ?? 0} />
            <StatsCard label="Medium" value={stats?.medium_tickets ?? 0} />
            <StatsCard label="Low" value={stats?.low_tickets ?? 0} />
          </div>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (activeMenu === 'dashboard') {
      return renderDashboard();
    }

    if (activeMenu === 'view-all') {
      return (
        <div>
          <TicketFilters
            filters={filters}
            onChange={updateFilter}
            onReset={resetFilters}
            onApply={applyFilters}
          />
          <TicketTable tickets={tickets} loading={loading} emptyText="No tickets found." showType={false} />
        </div>
      );
    }

    if (activeMenu === 'manage-tickets') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <TicketFilters
              filters={filters}
              onChange={updateFilter}
              onReset={resetFilters}
              onApply={applyFilters}
            />
            <TicketTable
              tickets={tickets}
              loading={loading}
              emptyText="No tickets found."
              showType={false}
              showActions={true}
              onView={setSelectedTicket}
            />
          </div>

          <div className="card p-6">
            <h3 className="text-xl font-semibold text-slate-900">Selected ticket</h3>
            {selectedTicket ? (
              <form onSubmit={handleTicketUpdate} className="mt-5 space-y-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{selectedTicket.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedTicket.description}</p>
                </div>
                <div>
                  <label className="label" htmlFor="ticketStatus">Status</label>
                  <select
                    id="ticketStatus"
                    value={statusValue}
                    onChange={(event) => setStatusValue(event.target.value)}
                    className="input"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ticketPriority">Priority</label>
                  <select
                    id="ticketPriority"
                    value={priorityValue}
                    onChange={(event) => setPriorityValue(event.target.value)}
                    className="input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ticketAssign">Assign user</label>
                  <select
                    id="ticketAssign"
                    value={assignedUserId}
                    onChange={(event) => setAssignedUserId(event.target.value)}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name} ({entry.email})</option>
                    ))}
                  </select>
                </div>
                {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
                <button type="submit" className="btn-primary w-full" disabled={saving}>
                  {saving ? 'Updating ticket...' : 'Save changes'}
                </button>

                <CommentsPanel
                  comments={comments}
                  commentText={commentText}
                  onCommentChange={(event) => setCommentText(event.target.value)}
                  onAddComment={handleAddComment}
                  loadingComments={loadingComments}
                  commentSaving={commentSaving}
                  textareaId="adminComment"
                />
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Select a ticket from the list first.</p>
            )}
          </div>
        </div>
      );
    }

    if (activeMenu === 'view-users') {
      return renderUserList();
    }

    if (activeMenu === 'user-tickets') {
      return renderUserTickets();
    }

    if (activeMenu === 'profile') {
      return <ProfileForm user={user} onSave={saveProfile} />;
    }

    return null;
  }

  return (
    <DashboardShell
      title="Ticket Management Dashboard"
      subtitle="Manage tickets, assign users, and control workflow status."
      menuItems={adminMenu}
      activeKey={activeMenu}
      onMenuChange={setActiveMenu}
    >
      <SectionHeader title={currentMenu.label} description={currentMenu.description} />
      {message ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error && activeMenu !== 'manage-tickets' ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {renderContent()}
    </DashboardShell>
  );
}
