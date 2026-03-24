import api from './client';


export async function registerUser(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}


export async function loginUser(payload) {
  const { data } = await api.post('/auth/login-json', payload);
  return data;
}


export async function getCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function getAllUsers(){
  const { data } = await api.get('/admin/users');
  return data

}

export async function updateProfile(payload) {
  const { data } = await api.patch('/auth/me', payload);
  return data;
}

export async function toggleUserStatus(userId, isActive) {
  const { data } = await api.patch(`/admin/users/${userId}/status`, null, {
    params: { is_active: isActive },
  });
  return data;
}
