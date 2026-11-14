// Real same-origin API. This module never falls back to mock/localStorage data.
const BASE = '/api/v1';
let token = null;
export class APIError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}
async function request(path, {method = 'GET', data} = {}) {
  if (method !== 'GET' && !token) await api.session();
  let response;
  try {
    response = await fetch(BASE + path, {
      method, credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', ...(method !== 'GET' ? {'X-CSRF-Token': token} : {})},
      ...(data !== undefined ? {body: JSON.stringify(data)} : {})
    });
  } catch { throw new APIError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR'); }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || payload?.error?.code === 'CSRF_INVALID') token = null;
    throw new APIError(payload?.error?.message || `Request failed (${response.status}).`, response.status, payload?.error?.code);
  }
  if (!payload || !('data' in payload)) throw new APIError('Unexpected server response.', 502, 'INVALID_RESPONSE');
  return payload.data;
}
export const api = {
  async session() { const s = await request('/auth/session'); token = s.csrf_token; return s.user; },
  async login(email, password) { const s = await request('/auth/login', {method:'POST', data:{email,password}}); token = s.csrf_token; return s.user; },
  async logout() { await request('/auth/logout', {method:'POST', data:{}}); token = null; },
  sellers: () => request('/sellers'),
  items: id => request(`/sellers/${id}/items`),
  groups: scope => request(`/group-orders?scope=${encodeURIComponent(scope)}`),
  orders: type => request(`/orders?type=${encodeURIComponent(type)}`),
  order: id => request(`/orders/${id}`),
  createIndividual: data => request('/orders', {method:'POST',data}),
  setIndividualItem: (id,item,quantity) => request(`/orders/${id}/items/${item}`, {method:'PUT',data:{quantity}}),
  removeIndividualItem: (id,item) => request(`/orders/${id}/items/${item}`, {method:'DELETE'}),
  placeIndividual: id => request(`/orders/${id}/place`, {method:'POST',data:{}}),
  cancelIndividual: id => request(`/orders/${id}/cancel`, {method:'POST',data:{}}),
  group: id => request(`/group-orders/${id}`),
  create: data => request('/group-orders', {method:'POST', data}),
  join: id => request(`/group-orders/${id}/members/me`, {method:'PUT', data:{}}),
  leave: id => request(`/group-orders/${id}/members/me`, {method:'DELETE'}),
  setItem: (id,item,quantity) => request(`/group-orders/${id}/items/${item}`, {method:'PUT',data:{quantity}}),
  removeItem: (id,item) => request(`/group-orders/${id}/items/${item}`, {method:'DELETE'}),
  cancel: id => request(`/group-orders/${id}/cancel`, {method:'POST',data:{}}),
  place: id => request(`/group-orders/${id}/place`, {method:'POST',data:{}})
};
