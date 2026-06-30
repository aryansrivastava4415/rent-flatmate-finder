const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  getTenantProfile: (token) => request('/tenant/profile', { token }),
  saveTenantProfile: (token, payload) => request('/tenant/profile', { method: 'PUT', body: payload, token }),

  createListing: (token, payload) => request('/listings', { method: 'POST', body: payload, token }),
  myListings: (token) => request('/listings/mine', { token }),
  browseListings: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/listings${qs ? `?${qs}` : ''}`, { token });
  },
  getListing: (token, id) => request(`/listings/${id}`, { token }),
  markFilled: (token, id) => request(`/listings/${id}/fill`, { method: 'PATCH', token }),

  expressInterest: (token, listingId) => request('/interests', { method: 'POST', body: { listingId }, token }),
  myInterests: (token) => request('/interests/mine', { token }),
  receivedInterests: (token) => request('/interests/received', { token }),
  respondInterest: (token, id, status) => request(`/interests/${id}`, { method: 'PATCH', body: { status }, token }),

  chatThreads: (token) => request('/chat', { token }),
  chatHistory: (token, interestId) => request(`/chat/${interestId}/messages`, { token }),

  adminUsers: (token) => request('/admin/users', { token }),
  adminToggleUser: (token, id, isActive) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: { isActive }, token }),
  adminListings: (token) => request('/admin/listings', { token }),
  adminActivity: (token) => request('/admin/activity', { token }),
};

export { API_URL };
