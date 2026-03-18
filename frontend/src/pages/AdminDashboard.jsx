import { useEffect, useMemo, useState } from 'react';
import { getAllTickets, updateTicket } from '../api/ticketApi';
import DashboardShell from '../layouts/DashboardShell';
import SectionHeader from '../components/SectionHeader';
import TicketCard from '../components/TicketCard';
import { getAllUsers } from '../api/authApi'; 
import { getTicketsByUser } from '../api/ticketApi'

const adminMenu = [
  {
    key: 'view-all',
    label: 'View All Tickets',
    description: 'View all tickets in a scrollable list.',
  },
  {
    key: 'update-status',
    label: 'Update Ticket Status',
    description: 'Select a ticket and change its workflow status.',
  },
  {
    key: 'manage-priority',
    label: 'Manage Ticket Priority',
    description: 'Select a ticket and update its urgency level.',
  },
  {
    key: 'view-users',
    label: 'View All Users'
  },
];

export default function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState('view-all');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statusValue, setStatusValue] = useState('open');
  const [priorityValue, setPriorityValue] = useState('low');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([])
  const [userTickets, setUserTickets] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)

  const currentMenu = useMemo(
    () => adminMenu.find((item) => item.key === activeMenu) || adminMenu[0],
    [activeMenu]
  );

  
  async function loadTickets() {
    setLoading(true);
    setError('');

    try {
      const data = await getAllTickets();
      setTickets(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length) {
        const first = data[0];
        setSelectedTicket(first);
        setStatusValue(first.status || 'open');
        setPriorityValue(first.priority || 'low');
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
      setUsers(data);
    } catch (err) {
      setError("Failed to laod users")
    }
  }

  async function loadUserTickets(userId) {
  try {
    const data = await getTicketsByUser(userId);
    setUserTickets(data);
  } catch (err) {
    setError('Failed to load user tickets');
  }
}


  useEffect(() => {
    if (
      activeMenu === 'view-all' ||
      activeMenu === 'update-status' ||
      activeMenu === 'manage-priority'
    ) {
      loadTickets();
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
    }
  }, [activeMenu, selectedTicket]);

  async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await updateTicket(selectedTicket.id, { status: statusValue });
      setMessage('Ticket status updated successfully.');
      replaceTicket(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update ticket status.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePriorityUpdate(event) {
    event.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await updateTicket(selectedTicket.id, { priority: priorityValue });
      setMessage('Ticket priority updated successfully.');
      replaceTicket(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update ticket priority.');
    } finally {
      setSaving(false);
    }
  }

  function replaceTicket(updatedTicket) {
    setTickets((prev) => prev.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
    setSelectedTicket(updatedTicket);
    setStatusValue(updatedTicket.status || 'open');
    setPriorityValue(updatedTicket.priority || 'low');
  }

  function renderTicketList(onSelectTicket) {
    if (loading) {
      return <div className="card p-6 text-sm text-slate-600">Loading tickets...</div>;
    }

    if (error && tickets.length === 0) {
      return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>;
    }

    if (!tickets.length) {
      return <div className="card p-6 text-sm text-slate-600">No tickets available yet.</div>;
    }

    return (
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            selected={selectedTicket?.id === ticket.id}
            onSelect={(item) => {
              setSelectedTicket(item);
              onSelectTicket?.(item);
            }}
          />
        ))}
      </div>
    );
  }

  function renderUserList() {
    if (!users.length) {
      return <p className="text-sm text-slate-500">No users found.</p>;
    }
    
    return (
    <div className="space-y-3">
      {users.map((user) => (
        <div
          key={user.id}
          onClick={() => {
            setSelectedUser(user);
            loadUserTickets(user.id);
            setActiveMenu('user-tickets');
          }}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
        >
          <p className="font-medium text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
          <p className="text-xs text-slate-400">Role: {user.role}</p>
        </div>
      ))}
    </div>
    );
  }

  function renderUserTickets() {
    if (!selectedUser) {
      return <p>No user selected</p>;
    }

    return (
      <div>
        <SectionHeader
          title={`Tickets for ${selectedUser.name}`}
          description="List of tickets created by this user"
        />


        {userTickets.length === 0 ? (
          <p className="text-sm text-slate-500">No tickets found</p>
        ) : (
          <div className="space-y-3">
            {userTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}


        <button
          onClick={() => setActiveMenu('view-users')}
          className="btn-secondary mt-4"
        >
          Back to Users
        </button>
      </div>
    );
  }


  function renderContent() {
    if (activeMenu === 'view-all') {
      return (
        <div>
          <SectionHeader
            title="All ticket records"
            description="This list shows all tickets."
          />
          {renderTicketList()}
        </div>
      );
    }

    if (activeMenu === 'update-status') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <SectionHeader
              title="Update ticket status"
              description="Choose one ticket from the list, then change its current status from the panel on the right."
            />
            {renderTicketList((item) => setStatusValue(item.status || 'open'))}
          </div>

          <div className="card p-6">
            <h3 className="text-xl font-semibold text-slate-900">Selected ticket</h3>
            {selectedTicket ? (
              <form onSubmit={handleStatusUpdate} className="mt-5 space-y-5">
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
                    <option value="closed">Closed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
                <button type="submit" className="btn-primary w-full" disabled={saving}>
                  {saving ? 'Updating status...' : 'Update Status'}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Select a ticket from the list first.</p>
            )}
          </div>
        </div>
      );
    }

    if (activeMenu === 'manage-priority') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <SectionHeader
            title="Manage ticket priority"
            description="Pick a ticket from the list and update its urgency level from the side editor."
          />
          {renderTicketList((item) => setPriorityValue(item.priority || 'low'))}
          </div>

          <div className="card p-6">
            <h3 className="text-xl font-semibold text-slate-900">Selected ticket</h3>
            {selectedTicket ? (
              <form onSubmit={handlePriorityUpdate} className="mt-5 space-y-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{selectedTicket.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{selectedTicket.description}</p>
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
                  </select>
                </div>
                {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
                <button type="submit" className="btn-primary w-full" disabled={saving}>
                  {saving ? 'Updating priority...' : 'Update Priority'}
                </button>
              </form>
            ) : (
            <p className="mt-4 text-sm text-slate-600">Select a ticket from the list first.</p>
            )}
          </div>
        </div>
      );
    }

    if (activeMenu == 'view-users') {
        return renderUserList();
    }

    if (activeMenu === 'user-tickets') {
      return renderUserTickets();
    }
    
    return null;
  }

  return (
    <DashboardShell
      title="Admin Panel"
      subtitle="Review all ticket activity, update workflow status, and manage ticket priority."
      menuItems={adminMenu}
      activeKey={activeMenu}
      onMenuChange={setActiveMenu}
    >
      {renderContent()}
    </DashboardShell>
  );
}
