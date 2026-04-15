import { useEffect, useRef, useState } from 'react';
import { getNotifications, getNotificationsSocketUrl, markNotificationsRead } from '../api/ticketApi';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const socketRef = useRef(null);

  async function loadNotifications() {
    try {
      const response = await getNotifications();
      const payload = response?.data || {};
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setUnreadCount(payload?.unread_count || 0);
    } catch {
      // ignore widget-only failures
    }
  }

  useEffect(() => {
    loadNotifications();
    const wsUrl = getNotificationsSocketUrl();
    if (!wsUrl.includes('token=')) return;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => socket.send('ping');
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'notification' && payload?.data) {
          setItems((prev) => {
            const filtered = prev.filter((item) => item.id !== payload.data.id);
            return [payload.data, ...filtered].slice(0, 10);
          });
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        // ignore malformed messages
      }
    };

    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send('ping');
      }
    }, 20000);

    return () => {
      clearInterval(heartbeat);
      socket.close();
    };
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      try {
        await markNotificationsRead();
        setUnreadCount(0);
        setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white"
      >
        🔔
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-3 w-96 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-soft">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
            <button type="button" className="text-xs text-slate-500" onClick={loadNotifications}>
              Refresh
            </button>
          </div>
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {items.length ? (
              items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No notifications yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
