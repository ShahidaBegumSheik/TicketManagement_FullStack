import { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import { getAllUsers, toggleUserStatus, updateUserRole } from '../api/authApi';
import {
  addTicketComment,
  getAllTickets,
  getDeletedTickets,
  restoreTicket,
  deleteTicket,
  getDashboardAnalytics,
  getTicketComments,
  getTicketById,
  updateTicket,
  exportTicketsCsv,
  bulkUpdateTicketStatus,
  bulkAssignTickets,
  bulkDeleteTickets,
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
    key: 'deleted-tickets',
    label: 'Deleted Tickets',
    description: 'View soft-deleted tickets and restore them.',
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
    '#3b82f6', // blue
    '#ef4444', // red
    '#22c55e', // green
    '#eab308', // yellow
    '#06b6d4', // cyan
    '#f97316', // orange
    '#8b5cf6', // purple
    '#10b981', // emerald
  ];

  const priorityColors = {
    urgent: '#ef4444',   // red
    high: '#eab308',     // yellow
    medium: '#f472b6',   // pink
    low: '#86efac',      // light green
  };

  const statusColors = {
    open: '#3b82f6',         // blue
    in_progress: '#f59e0b',  // amber
    closed: '#22c55e',       // green
    cancelled: '#ef4444',    // red
  };

  const normalizedColors = points.map((item, index) => {
    const key = String(item.label || '')
      .toLowerCase()
      .replace(/\s+/g, '_');

    return (
      priorityColors[key] ||
      statusColors[key] ||
      palette[index % palette.length]
    );
  });

  if (type === 'line') {
    return {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.18)',
          pointBackgroundColor: '#2563eb',
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
          backgroundColor: normalizedColors,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
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
        backgroundColor: normalizedColors,
        borderColor: normalizedColors,
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
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('status');
  const [bulkStatusValue, setBulkStatusValue] = useState('open');
  const [bulkAssignedUserId, setBulkAssignedUserId] = useState('');
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const { saveProfile, user } = useAuth();
  const [savedFilters, setSavedFilters] = useState([]);
  const [savedFilterName, setSaveFilterName] = useState('')

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

  async function loadDeletedTickets(currentPage = page) {
    setLoading(true);
    setError('');

    try {
      const data = await getDeletedTickets({
        page: currentPage,
        size: 10,
      });

      const ticketItems = Array.isArray(data?.items) ? data.items : [];
      setTickets(ticketItems);
      setMeta({
        page: data?.page ?? currentPage,
        total: data?.total ?? 0,
        total_pages: data?.pages ?? 1,
        limit: data?.size ?? 10,
      });
      setSelectedTicket(null);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load deleted tickets.');
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

  async function loadSavedFilters() {
    try {
      const data = await getSavedFilters();
      setSavedFilters(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Unable to laod saved filters', err);
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

  async function handleDeleteTicket(ticketId) {
    const confirmed = window.confirm('Are you sure you want to delete this ticket?');
    if (!confirmed) return;

    try {
      setError('');
      setMessage('');
      await deleteTicket(ticketId);
      setMessage('Ticket deleted successfully.');
      setSelectedTicket(null);
      await loadTickets(page, filters);
      await loadAnalytics();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete ticket.');
    }
  }

  async function handleRestoreTicket(ticketId) {
    try {
      setError('');
      setMessage('');
      await restoreTicket(ticketId);
      setMessage('Ticket restored successfully.');
      await loadDeletedTickets(page);
      await loadAnalytics();
    } catch(err) {
      setError(err?.response?.data?.detail || 'Failed to restor ticket.');
    }
  }

  useEffect(() => {
    if (activeMenu === 'dashboard') {
      loadAnalytics();
      loadUsers();
    }
    if (activeMenu === 'view-all' || activeMenu === 'manage-tickets') {
      loadTickets(page, filters);
      loadSavedFilters();
      loadUsers();
    }
    if (activeMenu == 'deleted-tickets') {
      loadDeletedTickets(page);
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

  function toggleTicketSelection(ticketId, checked) {
    setSelectedTicketIds((prev) => {
      if (checked) {
        return prev.includes(ticketId) ? prev : [...prev, ticketId];
      }
      return prev.filter((id) => id !== ticketId);
    });
  }


  function toggleAllTicketSelections(checked, pageTickets) {
    const idsOnPage = pageTickets.map((ticket) => ticket.id);
    if (checked) {
      setSelectedTicketIds((prev) => Array.from(new Set([...prev, ...idsOnPage])));
      return;
    }
    setSelectedTicketIds((prev) => prev.filter((id) => !idsOnPage.includes(id)));
  }

  function clearBulkSelection() {
    const defaultBulkAction = 'status';
    setSelectedTicketIds([]);
    setBulkAssignedUserId('');
    setBulkStatusValue('open');
    setBulkConfirmDelete(false);
    setBulkAction(defaultBulkAction);
  }

  async function handleBulkSubmit() {
    if (!selectedTicketIds.length) {
      setError('Select at least one ticket for a bulk action.');
      return;
    }

    try {
      setBulkSaving(true);
      setError('');
      setMessage('');

      let result;

      if (bulkAction === 'status') {
        result = await bulkUpdateTicketStatus({
          ticket_ids: selectedTicketIds,
          status: bulkStatusValue,
        });
      } else if (bulkAction === 'assign') {
        result = await bulkAssignTickets({
          ticket_ids: selectedTicketIds,
          assigned_user_id: bulkAssignedUserId ? Number(bulkAssignedUserId) : null,
        });
      } else if (bulkAction === 'delete') {
        result = await bulkDeleteTickets({
          ticket_ids: selectedTicketIds,
          confirm: bulkConfirmDelete,
        });
      }
      setMessage(result?.message || 'Bulk action completed successfully.');
      setSelectedTicketIds([])
      setBulkConfirmDelete(false)
    
      try {
        await loadTickets(page, filters);
        await loadAnalytics();
      } catch (refreshError) {
        console.error('Refresh failed after bulk action:', refreshError);
      }
    } catch(err) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Failed to perform bulk action.'
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function renderBulkActions() {
    return (
      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="lg:w-48">
            <label className="label" htmlFor="bulkAction">Bulk action</label>
            <select
              id="bulkAction"
              className="input"
              value={bulkAction}
              onChange={(event) => setBulkAction(event.target.value)}
            >
              <option value="status">Bulk status update</option>
              <option value="assign">Bulk assign</option>
              <option value="delete">Bulk delete</option>
            </select>
          </div>


          {bulkAction === 'status' ? (
            <div className="lg:w-48">
              <label className="label" htmlFor="bulkStatusValue">New status</label>
              <select
                id="bulkStatusValue"
                className="input"
                value={bulkStatusValue}
                onChange={(event) => setBulkStatusValue(event.target.value)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          ) : null}


          {bulkAction === 'assign' ? (
            <div className="lg:w-72">
              <label className="label" htmlFor="bulkAssignedUserId">Assign to</label>
              <select
                id="bulkAssignedUserId"
                className="input"
                value={bulkAssignedUserId}
                onChange={(event) => setBulkAssignedUserId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.role})</option>
                ))}
              </select>
            </div>
          ) : null}


          {bulkAction === 'delete' ? (
            <label className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <input
                type="checkbox"
                checked={bulkConfirmDelete}
                onChange={(event) => setBulkConfirmDelete(event.target.checked)}
              />
              Confirm bulk delete
            </label>
          ) : null}


          <div className="flex flex-1 items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Selected tickets: <span className="font-semibold">{selectedTicketIds.length}</span>
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={clearBulkSelection}>
                Clear selection
              </button>
              <button type="button" className="btn-primary" disabled={bulkSaving || !selectedTicketIds.length} onClick={handleBulkSubmit}>
                {bulkSaving ? 'Applying...' : 'Apply bulk action'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDeletedTickets() {
    return (
      <div className="space-y-6">
        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <TicketTable
          tickets={tickets}
          loading={loading}
          emptyText="No deleted tickets found."
          meta={meta}
          onPageChange={(next) => setPage(next)}
          showActions
          actionLabel="Restore"
          onAction={handleRestoreTicket}
          onView={undefined}
        />
      </div>
    );
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
          <div className="card mt-4 p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div>
                <label className="label" htmlFor="bulkAction">Bulk action</label>
                <select
                  id="bulkAction"
                  value={bulkAction}
                  onChange={(event) => setBulkAction(event.target.value)}
                  className="input"
                >
                  <option value="status">Bulk status update</option>
                  <option value="assign">Bulk assign</option>
                  <option value="delete">Bulk delete</option>
                </select>
              </div>

              {bulkAction === 'status' ? (
                <div>
                  <label className="label" htmlFor="bulkStatus">New status</label>
                  <select
                    id="bulkStatus"
                    value={bulkStatusValue}
                    onChange={(event) => setBulkStatusValue(event.target.value)}
                    className="input"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ) : null}

              {bulkAction === 'assign' ? (
                <div>
                  <label className="label" htmlFor="bulkAssign">Assign user/support agent</label>
                  <select
                    id="bulkAssign"
                    value={bulkAssignedUserId}
                    onChange={(event) => setBulkAssignedUserId(event.target.value)}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name} ({entry.role})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {bulkAction === 'delete' ? (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <input
                    id="bulkDeleteConfirm"
                    type="checkbox"
                    checked={bulkConfirmDelete}
                    onChange={(event) => setBulkConfirmDelete(event.target.checked)}
                  />
                  <label htmlFor="bulkDeleteConfirm" className="text-sm text-rose-700">
                    I confirm bulk delete
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Selected tickets: <span className="font-semibold text-slate-900">{selectedTicketIds.length}</span>
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedTicketIds([]);
                    setBulkConfirmDelete(false);
                  }}
                >
                  Clear selection
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={bulkSaving || selectedTicketIds.length === 0}
                  onClick={handleBulkSubmit}
                >
                  {bulkSaving ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          <TicketTable 
            tickets={tickets}
            loading={loading}
            emptyText="No tickets found."
            showActions={false}
            onView={handleSelectTicket}
            meta={meta}
            onPageChange={(next) => setPage(next)}
            selectable
            selectedIds={selectedTicketIds}
            onToggleSelect={toggleTicketSelection}
            onToggleSelectAll={toggleAllTicketSelections}/>
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
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={saving}
                  >
                    {saving ? 'Updating ticket...' : 'Save changes'}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
                    onClick={() => handleDeleteTicket(selectedTicket.id)}
                  >
                    Delete
                  </button>
                </div>
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
    if (activeMenu === 'deleted-tickets') return renderDeletedTickets();
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
