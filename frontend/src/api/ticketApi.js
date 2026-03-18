import api from './client';


export async function createTicket(payload) {
  const { data } = await api.post('/tickets', payload);
  return data;
}


export async function getMyTickets() {
  const { data } = await api.get('/tickets');
  return data;
}


export async function getTicketById(ticketId) {
  const { data } = await api.get(`/tickets/${ticketId}`);
  return data;
}


export async function getAllTickets() {
  const { data } = await api.get('/admin/tickets');
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
