import { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import { getAllUsers, toggleUserStatus, updateUserRole } from '../api/authApi';
import {
  addTicketComment,
  getAllTickets,
  getDashboardAnalytics,
  getTicketComments,
  getTicketById,
  updateTicket,
  exportTicketsCsv,
} from '../api/ticketApi';
import ActivityTimeline from '../components/ActivityTimeline';
import AttachmentList from '../components/AttachmentList';
import ChartCard from '../components/ChartCard';
import CommentsPanel from '../components/CommentsPanel';
import EmptyState from '../components/EmptyState';
import ProfileForm from '../components/ProfileForm';
import SectionHeader from '../components/SectionHeader';
import StatsCard from '../components/StatsCard';
import TicketFilters from '../components/TicketFilters';
import TicketTable from '../components/TicketTable';
import { useAuth } from '../contexts/AuthContext';
import DashboardShell from '../layouts/DashboardShell';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

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

function chartData(points, label, type = 'bar') {
  const labels = points.map((item) => item.label);
  const values = points.map((item) => item.value);

  const palette = [
  '#a5b4fc', // light indigo
  '#c4b5fd', // light violet
  '#67e8f9', // light cyan
  '#6ee7b7', // light emerald
  '#fde68a', // light amber
  '#fca5a5', // light red
  '#f9a8d4', // light pink
  '#93c5fd', // light blue
];



  if (type === 'line') {
    return {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.18)',
          pointBackgroundColor: '#7c3aed',
          pointBorderColor: '#ffffff',
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.35,
        },
      ],
    };
  }

  if (type === 'pie' || type === 'doughnut') {
    return {
      labels,
      datasets: [
        {
          label,
          data: values,
          backgroundColor: palette.slice(0, values.length),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  }

  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        backgroundColor: palette.slice(0, values.length),
        borderColor: palette.slice(0, values.length),
        borderWidth: 1,
        borderRadius: 10,
      },
    ],
  };
}


export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statusValue, setStatusValue] = useState('open');
  const [priorityValue, setPriorityValue] = useState('low');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const { saveProfile, user } = useAuth();

  const currentMenu = useMemo(
    () => adminMenu.find((item) => item.key === activeMenu) || adminMenu[0],
    [activeMenu]
  );

  const assignableUsers = useMemo(
    () => users.filter((item) => item.role === 'support_agent' && item.is_active),
    [users]
  );

  async function loadTickets(currentPage = page, customFilters = filters) {
    setLoading(true);
    setError('');

    try {
      const params = Object.fromEntries(Object.entries(customFilters).filter(([, value]) => value));
      params.page = currentPage;
      params.size = 10;
      const data = await getAllTickets(params);
      const ticketItems = Array.isArray(data?.items) ? data.items : [];
      setTickets(ticketItems);
      setMeta({
        page: data?.page ?? currentPage,
        total: data?.total ?? 0,
        total_pages: data?.pages ?? 1,
        limit: data?.size ?? 10,
      });
      if (ticketItems.length) {
        await handleSelectTicket(data.items[0], false);
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
    } catch {
      setError('Failed to load users');
    }
  }

  async function loadAnalytics() {
    try {
      const data = await getDashboardAnalytics();
      setAnalytics(data);
    } catch {
      setError('Failed to load dashboard analytics.');
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

  async function handleSelectTicket(ticket, loadCommentList = true) {
    try {
      const data = await getTicketById(ticket.id);
      setSelectedTicket(data);
      setStatusValue(data.status || 'open');
      setPriorityValue(data.priority || 'low');
      setAssignedUserId(data.assigned_user_id ? String(data.assigned_user_id) : '');
      if (loadCommentList) {
        loadComments(data.id);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load ticket details.');
      setSelectedTicket(ticket);
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
      await handleSelectTicket(selectedTicket, false);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add comment.');
    } finally {
      setCommentSaving(false);
    }
  }

  useEffect(() => {
    if (activeMenu === 'dashboard') {
      loadAnalytics();
      loadUsers();
    }
    if (activeMenu === 'view-all' || activeMenu === 'manage-tickets') {
      loadTickets(page, filters);
      loadUsers();
    }
    if (activeMenu === 'view-users') {
      loadUsers();
    }
    setMessage('');
    setError('');
  }, [activeMenu, page]);

  useEffect(() => {
    if (selectedTicket?.id && activeMenu === 'manage-tickets') {
      loadComments(selectedTicket.id);
    } 
  }, [selectedTicket, activeMenu]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function applyFilters() {
    setPage(1);
    await loadTickets(1, filters);
  }

  async function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
    await loadTickets(1, defaultFilters);
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
      payload.assigned_user_id = assignedUserId ? Number(assignedUserId) : 0;
      const updated = await updateTicket(selectedTicket.id, payload);
      setMessage('Ticket updated successfully.');
      await handleSelectTicket(updated);
      await loadTickets(page, filters);
      await loadAnalytics();
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

  async function handleUserRoleChange(targetUser, newRole) {
    setError('');
    setMessage('');

    try {
      await updateUserRole(targetUser.id, newRole);
      await loadUsers();
      setMessage(`Role updated to ${newRole}.`);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update user role.');
    }
  }

  async function handleExportCsv() {
    try {
      const blob = await exportTicketsCsv();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tickets.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export CSV.');
    }
  }

  function renderDashboard() {
    const summary = analytics?.summary;
    return (
      <div className="space-y-8">
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Total tickets" value={summary?.total_tickets ?? 0} />
          <StatsCard label="Open tickets" value={summary?.open_tickets ?? 0} />
          <StatsCard label="Closed tickets" value={summary?.closed_tickets ?? 0} />
          <StatsCard label="Avg. resolution (hrs)" value={analytics?.average_resolution_hours ?? 0} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Tickets created per day" description="Line chart powered by Chart.js." type="line" data={chartData(analytics?.tickets_per_day || [], 'Tickets')} />
          <ChartCard title="Status distribution" description="Open vs closed backlog view." type="pie" data={chartData(analytics?.status_distribution || [], 'Tickets')} />
          <ChartCard title="Priority distribution" description="Urgency mix across the queue." type="doughnut" data={chartData(analytics?.priority_distribution || [], 'Tickets')} />
          <ChartCard title="Most active users" description="Top ticket creators." type="bar" data={chartData(analytics?.most_active_users || [], 'Tickets')} />
        </div>
      </div>
    );
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

              <div className="flex flex-col gap-3 md:min-w-[240px]">
                <select
                  value={entry.role}
                  onChange={(event) => handleUserRoleChange(entry, event.target.value)}
                  className="input"
                  disabled={entry.role === "admin"}
                >
                  {entry.role === "admin" ? (
                    <option value= "admin">Admin</option>
                  ) : (
                    <>
                      <option value="user">User</option>
                      <option value="support_agent">Support Agent</option>
                    </>
                  )}
                </select>
                <button
                    type="button"
                    onClick={() => handleUserToggle(entry)} className="btn-primary">
                    {entry.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderManageTickets() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <TicketFilters filters={filters} onChange={updateFilter} onReset={resetFilters} onApply={applyFilters} />
          <TicketTable tickets={tickets} loading={loading} emptyText="No tickets found." showActions={false} onView={handleSelectTicket} meta={meta} onPageChange={(next) => setPage(next)} />
        </div>
        <div className="space-y-6">
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
                  <select id="ticketStatus" value={statusValue} onChange={(event) => setStatusValue(event.target.value)} className="input">
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ticketPriority">Priority</label>
                  <select id="ticketPriority" value={priorityValue} onChange={(event) => setPriorityValue(event.target.value)} className="input">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ticketAssign">Assign user/support agent</label>
                  <select id="ticketAssign" value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)} className="input">
                    <option value="">Unassigned</option>
                    {assignableUsers.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name} ({entry.role})</option>
                    ))}
                  </select>
                </div>
                {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
                <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Updating ticket...' : 'Save changes'}</button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Select a ticket from the list first.</p>
            )}
          </div>

          {selectedTicket ? (
            <>
              <div className="card p-6">
                <CommentsPanel
                  comments={comments}
                  commentText={commentText}
                  onCommentChange={(event) => setCommentText(event.target.value)}
                  onAddComment={handleAddComment}
                  loadingComments={loadingComments}
                  commentSaving={commentSaving}
                  textareaId="adminComment"
                />
              </div>

              <AttachmentList ticketId={selectedTicket.id} attachments={selectedTicket.attachments || []} />
              <ActivityTimeline items={selectedTicket.activities || []} />
            </>
          ) : null}
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
          <TicketTable tickets={tickets} loading={loading} emptyText="No tickets found." meta={meta} onPageChange={(next) => setPage(next)} />
        </div>
      );
    }

    if (activeMenu === 'manage-tickets') return renderManageTickets();
    if (activeMenu === 'view-users') return renderUserList();
    if (activeMenu === 'profile') return <ProfileForm user={user} onSave={saveProfile} />;
    return null;
  }

  return (
    <DashboardShell
      title="Ticket Management Dashboard"
      subtitle="Manage tickets, assign users, track analytics, and receive live updates."
      menuItems={adminMenu}
      activeKey={activeMenu}
      onMenuChange={setActiveMenu}
    >
      <SectionHeader title={currentMenu.label} description={currentMenu.description} />
      {renderContent()}
    </DashboardShell>
  );
}
