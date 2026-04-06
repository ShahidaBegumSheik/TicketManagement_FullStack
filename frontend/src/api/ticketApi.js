import api from './client';

export async function createTicket(formData) {
  const { data } = await api.post('/tickets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function checkDuplicateTicket(params) {
  const { data } = await api.get('/tickets/duplicate-check', { params });
  return data;
}


export async function getMyTickets(params = {}) {
  const { data } = await api.get('/tickets', { params });
  return data;
}


export async function getTicketById(ticketId) {
  const { data } = await api.get(`/tickets/${ticketId}`);
  return data;
}


export async function getAllTickets(params = {}) {
  const { data } = await api.get('/admin/tickets', { params });
  return data;
}


export async function updateTicket(ticketId, payload) {
  const { data } = await api.patch(`/admin/tickets/${ticketId}`, payload);
  return data;
}


export async function getTicketComments(ticketId) {
  const { data } = await api.get(`/tickets/${ticketId}/comments`);
  return data;
}

export async function addTicketComment(ticketId, payload) {
  const { data } = await api.post(`/tickets/${ticketId}/comments`, payload);
  return data;
}

export async function getDashboardAnalytics() {
  const { data } = await api.get('/admin/dashboard-analytics');
  return data;
}

export async function getNotifications() {
  const { data } = await api.get('/notifications');
  return data;
}

export async function markNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data;
}

export async function reopenTicket(ticketId, payload) {
  const { data } = await api.post(`/tickets/${ticketId}/reopen`, payload);
  return data;
}

export async function uploadTicketAttachments(ticketId, files) {
  const formData = new FormData();
  Array.from(files || []).forEach((file) => formData.append('files', file));
  const { data } = await api.post(`/tickets/${ticketId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function getAttachmentUrl(ticketId, attachmentId) {
  const base = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1';
  return `${base}/tickets/${ticketId}/attachments/${attachmentId}`;
}

export function getNotificationsSocketUrl() {
  const token = localStorage.getItem('ticket_access_token');
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1';
  const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api\/v1$/, '');
  return `${wsBase}/api/v1/ws/notifications?token=${encodeURIComponent(token || '')}`;
}

export function getTicketsCsvUrl() {
  const base = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1';
  const token = localStorage.getItem('ticket_access_token');
  return `${base}/admin/export?token=${encodeURIComponent(token || '')}`;
}


export async function exportTicketsCsv() {
  const response = await api.get('/admin/export', { responseType: 'blob' });
  return response.data;
}