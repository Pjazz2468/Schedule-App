const BASE = 'https://schedule-app-k0ob.onrender.com/api';

const req = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
};

export const api = {
  me: () => req('GET', '/auth/me'),
  login: (data) => req('POST', '/auth/login', data),
  register: (data) => req('POST', '/auth/register', data),
  logout: () => req('POST', '/auth/logout'),

  getEvents: (ownerId) => req('GET', `/calendar/events${ownerId ? `?owner=${ownerId}` : ''}`),
  saveEvents: (dateKey, events, ownerId) =>
    req('PUT', `/calendar/events/${dateKey}${ownerId ? `?owner=${ownerId}` : ''}`, { events }),

  getGroups: (ownerId) => req('GET', `/calendar/groups${ownerId ? `?owner=${ownerId}` : ''}`),
  addGroup: (group, ownerId) =>
    req('POST', `/calendar/groups${ownerId ? `?owner=${ownerId}` : ''}`, group),
  deleteGroup: (id, ownerId) =>
    req('DELETE', `/calendar/groups/${id}${ownerId ? `?owner=${ownerId}` : ''}`),

  getTracker: (ownerId) => req('GET', `/tracker${ownerId ? `?owner=${ownerId}` : ''}`),
  saveCell: (cellKey, data, ownerId) =>
    req('PUT', `/tracker/${encodeURIComponent(cellKey)}${ownerId ? `?owner=${ownerId}` : ''}`, { data }),
  deleteCell: (cellKey, ownerId) =>
    req('DELETE', `/tracker/${encodeURIComponent(cellKey)}${ownerId ? `?owner=${ownerId}` : ''}`),

  getShares: () => req('GET', '/shares'),
  getReceivedShares: () => req('GET', '/shares/received'),
  addShare: (email, role) => req('POST', '/shares', { email, role }),
  updateShare: (id, role) => req('PUT', `/shares/${id}`, { role }),
  removeShare: (id) => req('DELETE', `/shares/${id}`),
};
