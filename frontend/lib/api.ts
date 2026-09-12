const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: (token: string) => apiFetch('/auth/me', {}, token),

  getCards: (token: string) => apiFetch('/cards', {}, token),
  createCard: (token: string, data: unknown) =>
    apiFetch('/cards', { method: 'POST', body: JSON.stringify(data) }, token),

  getStatements: (token: string, cardAccountId?: string) =>
    apiFetch(`/statements${cardAccountId ? `?card_account_id=${cardAccountId}` : ''}`, {}, token),
  getStatement: (token: string, id: string) => apiFetch(`/statements/${id}`, {}, token),
  uploadStatement: (token: string, formData: FormData) =>
    apiFetch('/statements/upload', { method: 'POST', body: formData }, token),
  deleteStatement: (token: string, id: string) =>
    apiFetch(`/statements/${id}`, { method: 'DELETE' }, token),

  getRules: (token: string) => apiFetch('/rules', {}, token),
  createRule: (token: string, data: unknown) =>
    apiFetch('/rules', { method: 'POST', body: JSON.stringify(data) }, token),
  updateRule: (token: string, id: string, data: unknown) =>
    apiFetch(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),
  deleteRule: (token: string, id: string) => apiFetch(`/rules/${id}`, { method: 'DELETE' }, token),

  getTransactions: (token: string, params: Record<string, string>) =>
    apiFetch(`/transactions?${new URLSearchParams(params).toString()}`, {}, token),
  updateTransaction: (token: string, id: string, data: unknown) =>
    apiFetch(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token),

  getPlannedPurchases: (token: string) => apiFetch('/planned-purchases', {}, token),
  createPlannedPurchase: (token: string, data: unknown) =>
    apiFetch('/planned-purchases', { method: 'POST', body: JSON.stringify(data) }, token),
  deletePlannedPurchase: (token: string, id: string) =>
    apiFetch(`/planned-purchases/${id}`, { method: 'DELETE' }, token),

  getDashboardSummary: (token: string, period: string) =>
    apiFetch(`/dashboard/summary?period=${period}`, {}, token),
  getDashboardHistory: (token: string, cardAccountId?: string) =>
    apiFetch(`/dashboard/history${cardAccountId ? `?card_account_id=${cardAccountId}` : ''}`, {}, token),
  getProjections: (token: string, cardAccountId: string, months?: number) =>
    apiFetch(
      `/dashboard/projections?card_account_id=${cardAccountId}${months ? `&months=${months}` : ''}`,
      {},
      token
    ),
};
