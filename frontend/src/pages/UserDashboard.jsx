import { useEffect, useMemo, useState } from 'react';
import {
  addTicketComment,
  checkDuplicateTicket,
  createTicket,
  getMyTickets,
  getTicketById,
  getTicketComments,
  reopenTicket,
  updateTicket,
  uploadTicketAttachments,
} from '../api/ticketApi';
import ActivityTimeline from '../components/ActivityTimeline';
import AttachmentList from '../components/AttachmentList';
import CommentsPanel from '../components/CommentsPanel';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ProfileForm from '../components/ProfileForm';
import SectionHeader from '../components/SectionHeader';
import TicketFilters from '../components/TicketFilters';
import TicketTable from '../components/TicketTable';
import { useAuth } from '../contexts/AuthContext';
import DashboardShell from '../layouts/DashboardShell';
import TagList from '../components/TagList';  

const defaultFilters = { search: '', status: '', priority: '' };

const standardUserMenu = [
  { key: 'create-ticket', label: 'Create Ticket', description: 'Submit a new support issue with attachments.' },
  { key: 'view-my-tickets', label: 'View My Tickets', description: 'Search, filter, and page through tickets.' },
  { key: 'ticket-details', label: 'Ticket Details', description: 'View comments, attachments, and activity.' },
  { key: 'profile', label: 'My Profile', description: 'Update your basic account details.' },
];

const agentMenu = [
  { key: 'view-my-tickets', label: 'Assigned Tickets', description: 'View the tickets assigned to you.' },
  { key: 'ticket-details', label: 'Ticket Details', description: 'Update status and collaborate on tickets.' },
  { key: 'profile', label: 'My Profile', description: 'Update your basic account details.' },
];

export default function UserDashboard() {
  const { saveProfile, user } = useAuth();
  const [activeMenu, setActiveMenu] = useState('create-ticket');
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState(null);
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
  const [page, setPage] = useState(1);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [form, setForm] = useState({ title: '', description: '', priority: 'low', tags: '', files: [] });
  const isSupportAgent = user?.role === 'support_agent';
  const userMenu = isSupportAgent ? agentMenu : standardUserMenu;

  const currentMenu = useMemo(
    () => userMenu.find((item) => item.key === activeMenu) || userMenu[0],
    [activeMenu, userMenu]
  );

  async function loadTickets(currentPage = page, customFilters = filters) {
    setLoadingTickets(true);
    setError('');

    try {
      const params = Object.fromEntries(Object.entries(customFilters).filter(([, value]) => value));
      params.page = currentPage;
      params.size = 10;
      const data = await getMyTickets(params);
      setTickets(Array.isArray(data?.items) ? data.items : []);
      setMeta({
        page: data?.page ?? currentPage,
        total: data?.total ?? 0,
        total_pages: data?.pages ?? 1,
        limit: data?.size ?? 10,
      });
      if (Array.isArray(data?.items) && data.items.length) {
        const existsInPage = detailsTicket && data.items.some((item) => item.id === detailsTicket.id);
        if (!detailsTicket || !existsInPage) {
          setDetailsTicket(data.items[0]);
        }
      } else {
        setDetailsTicket(null);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to load your tickets.');
    } finally {
      setLoadingTickets(false);
    }
  }

  function updateField(event) {
    const { name, value, files } = event.target;

    if (name === 'files') {
      setForm((prev) => ({ ...prev, files: Array.from(files || []) }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  }

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

  async function handleCreateTicket(event) {
    event.preventDefault();
    
    try {
      setFormLoading(true);
      setError('');
      setMessage('');

      const duplicate = await checkDuplicateTicket({ title: form.title, description: form.description });
      if (duplicate?.is_duplicate) {
        setMessage(`${duplicate.message} You can still submit if it is a different issue.`);
      }
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('priority', form.priority);

      const tagList = (form.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      tagList.forEach((tag) => {
        formData.append('tags', tag);
      });

      (form.files || []).forEach((file) => {
        formData.append('files', file)
      });
      const created = await createTicket(formData);
      setMessage('Ticket created successfully.');
      setForm({ title: '', description: '', priority: 'low' , tags: '', files: []});
      setDetailsTicket(created);
      loadTickets(1, filters);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create ticket.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSelectTicket(ticket) {
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
      await handleSelectTicket(detailsTicket);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add comment.');
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleUploadAttachments(event) {
    const files = event.target.files;
    if (!detailsTicket || !files?.length) return;
    setUploadingFiles(true);
    setError('');
    try {
      await uploadTicketAttachments(detailsTicket.id, files);
      setMessage('Attachment uploaded successfully.');
      await handleSelectTicket(detailsTicket);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to upload attachment.');
    } finally {
      setUploadingFiles(false);
      event.target.value = '';
    }
  }

  async function handleReopenTicket() {
    if (!detailsTicket || !reopenReason.trim()) return;
    try {
      const updated = await reopenTicket(detailsTicket.id, { reason: reopenReason.trim() });
      setMessage('Ticket reopened successfully.');
      setReopenReason('');
      setDetailsTicket(updated);
      await handleSelectTicket(updated);
      loadTickets(page, filters);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to reopen ticket.');
    }
  }

  async function handleSupportStatusChange(status) {
    if (!detailsTicket || !isSupportAgent) return;
    try {
      const updated = await updateTicket(detailsTicket.id, { status });
      setDetailsTicket(updated);
      setMessage('Ticket status updated successfully.');
      await handleSelectTicket(updated);
      loadTickets(page, filters);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update ticket status.');
    }
  }

  useEffect(() => {
    if (isSupportAgent && activeMenu === 'create-ticket') {
      setActiveMenu('view-my-tickets');
    }
  }, [isSupportAgent, activeMenu]);


  useEffect(() => {
    if (activeMenu === 'view-my-tickets' || activeMenu === 'ticket-details') {
      loadTickets(page, filters);
    }
  }, [activeMenu, page]);

  useEffect(() => {
    if (detailsTicket?.id) {
      loadComments(detailsTicket.id);
    } else {
      setComments([]);
      setCommentText('');
    }
  }, [detailsTicket]);


  function renderCreate() {
    return (
      <div className="card mx-auto max-w-3xl p-6">
        <form onSubmit={handleCreateTicket} className="space-y-5">
          <div>
            <label className="label" htmlFor="title">Ticket title</label>
            <input id="title" name="title" className="input" value={form.title} onChange={updateField} placeholder="Enter a short issue title" required />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" className="input min-h-36 resize-none" value={form.description} onChange={updateField} placeholder="Describe the issue in detail" required />
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
          <div>
            <label className="label" htmlFor="tags">Tags</label>
            <input
              id="tags"
              name="tags"
              type="text"
              className="input"
              value={form.tags}
              onChange={updateField}
              placeholder="Enter tags separated by commas (e.g. Bug, Urgent)"
            />
            <p className="mt-2 text-xs text-slate-500">
              Add multiple tags separated by commas.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="files">Attachments</label>
            <input id="files" name="files" type="file" className="input" multiple accept=".png,.jpg,.jpeg,.pdf" onChange={updateField} />
            <p className="mt-2 text-xs text-slate-500">Images and PDFs only. Maximum 5 MB per file.</p>
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

  function renderTicketList() {
    return (
      <div>
        <TicketFilters filters={filters} onChange={updateFilter} onReset={resetFilters} onApply={applyFilters} />
        {error ? (
          <div className='mt-4 rounded-2xl border-rose-200 bg-rose-50 px-40 text-sm text-rose-700'>
            {error}
            </div>
         ) : null }
        <TicketTable
          tickets={tickets}
          loading={loadingTickets}
          emptyText={isSupportAgent ? 'No assigned tickets found.' : 'No tickets found.'}
          referenceUserId={user?.id}
          showType={!isSupportAgent}
          showActions={false}
          onView={handleSelectTicket}
          meta={meta}
          onPageChange={(next) => setPage(next)}
        />
      </div>
    );
  }

  function renderDetails() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <TicketFilters
            filters={filters}
            onChange={updateFilter}
            onReset={resetFilters}
            onApply={applyFilters}
          />

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-4">
            <TicketTable
              tickets={tickets}
              loading={loadingTickets}
              emptyText={isSupportAgent ? 'No assigned tickets found.' : 'No tickets found.'}
              referenceUserId={user?.id}
              showType={!isSupportAgent}
              showActions={false}
              onView={handleSelectTicket}
              meta={meta}
              onPageChange={(next) => setPage(next)}
            />
          </div>
        </div>

        <div className="space-y-6">
          {loadingDetails ? (
            <LoadingState text="Loading ticket details..." />
          ) : !detailsTicket ? (
            <EmptyState text="Select a ticket from the list to view its details." />
          ) : (
            <>
              <div className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{detailsTicket.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{detailsTicket.description}</p>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">Tags</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {detailsTicket.tags?.length ? (
                          detailsTicket.tags.map((tag) => (
                            <span
                              key={tag.id ?? tag.name}
                              className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700"
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No tags</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    <div>
                      Status: <span className="font-semibold text-slate-900">{detailsTicket.status}</span>
                    </div>
                    <div>
                      Priority: <span className="font-semibold text-slate-900">{detailsTicket.priority}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-500">Created By</p>
                    <p className="mt-1 text-base text-slate-900">{detailsTicket.creator_name || '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-500">Assigned To</p>
                    <p className="mt-1 text-base text-slate-900">
                      {detailsTicket.assigned_user_name || 'Unassigned'}
                    </p>
                  </div>
                </div>

                {message ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {message}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <label className="btn-secondary cursor-pointer">
                    {uploadingFiles ? 'Uploading...' : 'Upload attachments'}
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".png,.jpg,.jpeg,.pdf"
                      onChange={handleUploadAttachments}
                    />
                  </label>

                  {isSupportAgent ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleSupportStatusChange('in_progress')}
                      >
                        Mark In Progress
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleSupportStatusChange('closed')}
                      >
                        Mark Closed
                      </button>
                    </>
                  ) : null}
                </div>

                {!isSupportAgent && detailsTicket.status === 'closed' ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                    <label className="label" htmlFor="reopenReason">Reopen reason</label>
                    <textarea
                      id="reopenReason"
                      className="input min-h-24 resize-none"
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                      placeholder="Why should this ticket be reopened?"
                    />
                    <button
                      type="button"
                      className="btn-primary mt-3"
                      onClick={handleReopenTicket}
                      disabled={!reopenReason.trim()}
                    >
                      Reopen Ticket
                    </button>
                  </div>
                ) : null}

                <CommentsPanel
                  comments={comments}
                  commentText={commentText}
                  onCommentChange={(event) => setCommentText(event.target.value)}
                  onAddComment={handleAddComment}
                  loadingComments={loadingComments}
                  commentSaving={commentSaving}
                  textareaId="ticketComment"
                  title="Discussion"
                />
              </div>

              <AttachmentList ticketId={detailsTicket.id} attachments={detailsTicket.attachments || []} />
              <ActivityTimeline items={detailsTicket.activities || []} />
            </>
          )}
        </div>
      </div>
    );
  }


  function renderContent() {
    if (activeMenu === 'create-ticket' && !isSupportAgent) return renderCreate();
    if (activeMenu === 'view-my-tickets') return renderTicketList();
    if (activeMenu === 'ticket-details') return renderDetails();
    if (activeMenu === 'profile') return <ProfileForm user={user} onSave={saveProfile} />;
    return renderTicketList();
  }

  return (
    <DashboardShell
      title={isSupportAgent ? 'Support Agent Dashboard' : 'User Dashboard'}
      subtitle={isSupportAgent ? 'Handle your assigned tickets with comments and live notifications.' : 'Create tickets, track updates, and reopen closed issues.'}
      menuItems={userMenu}
      activeKey={activeMenu}
      onMenuChange={setActiveMenu}
    >
      <SectionHeader title={currentMenu.label} description={currentMenu.description} />
      {renderContent()}
    </DashboardShell>
  );
}
