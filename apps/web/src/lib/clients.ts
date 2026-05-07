import type {
  Client,
  ClientSummary,
  PaginatedResponse,
} from '@versuitality/types';

import { api, API_BASE } from './api';
import { useAuthStore } from '@/store/authStore';

export interface ClientListParams {
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listClients({
  q,
  limit = 25,
  offset = 0,
}: ClientListParams = {}): Promise<PaginatedResponse<Client>> {
  const params = new URLSearchParams();
  if (q) params.set('search', q);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return api<PaginatedResponse<Client>>(`/api/clients/?${params.toString()}`);
}

export async function searchClients(
  q: string,
  limit = 8,
): Promise<ClientSummary[]> {
  if (!q.trim()) return [];
  const data = await api<{ results: ClientSummary[] }>(
    `/api/clients/search/?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
  return data.results;
}

export async function getClient(id: string): Promise<Client> {
  return api<Client>(`/api/clients/${id}/`);
}

export async function clientByMobile(mobile: string): Promise<Client | null> {
  const data = await api<{ match: Client | null }>(
    `/api/clients/by_mobile/?mobile=${encodeURIComponent(mobile)}`,
  );
  return data.match;
}

export type ClientCreatePayload = Omit<
  Client,
  | 'id'
  | 'client_id'
  | 'created_at'
  | 'updated_at'
  | 'measurement_count'
  | 'last_measurement_at'
  | 'order_count'
>;

export async function createClient(payload: ClientCreatePayload): Promise<Client> {
  return api<Client>('/api/clients/', { method: 'POST', body: payload });
}

export async function updateClient(
  id: string,
  payload: Partial<ClientCreatePayload>,
): Promise<Client> {
  return api<Client>(`/api/clients/${id}/`, {
    method: 'PATCH',
    body: payload,
  });
}

/** Triggers a download of the client's measurement history as Excel. */
export async function exportMeasurementsXlsx(client: Client): Promise<void> {
  const access = useAuthStore.getState().access;
  const res = await fetch(
    `${API_BASE}/api/clients/${client.id}/measurements/export/`,
    {
      headers: access ? { Authorization: `Bearer ${access}` } : undefined,
    },
  );
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `measurements_${client.client_id}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
