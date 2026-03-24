import api from './client';


export async function createTicket(payload) {
  const { data } = await api.post('/tickets', payload);
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


export async function getTicketsByUser(userId) {
  const { data } = await api.get(`/admin/users/${userId}/tickets`);
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


export async function getDashboardStats() {
  const { data } = await api.get('/admin/dashboard-stats');
  return data;
}