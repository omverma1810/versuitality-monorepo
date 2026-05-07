import type {
  Fabric,
  FabricUsageEntry,
  PaginatedResponse,
  UsageKind,
} from '@versuitality/types';

import { api } from './api';

export interface ListFabricsParams {
  q?: string;
  active?: boolean;
  low_stock?: boolean;
}

export async function listFabrics(
  params: ListFabricsParams = {},
): Promise<PaginatedResponse<Fabric>> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.active !== undefined) sp.set('active', String(params.active));
  if (params.low_stock) sp.set('low_stock', 'true');
  sp.set('limit', '100');
  return api<PaginatedResponse<Fabric>>(`/api/fabrics/?${sp.toString()}`);
}

export async function getFabric(id: string): Promise<Fabric> {
  return api<Fabric>(`/api/fabrics/${id}/`);
}

export async function listLowStock(): Promise<Fabric[]> {
  const data = await api<{ count: number; results: Fabric[] }>(
    '/api/fabrics/low_stock/',
  );
  return data.results;
}

export async function fabricUsage(id: string): Promise<FabricUsageEntry[]> {
  return api<FabricUsageEntry[]>(`/api/fabrics/${id}/usage/`);
}

export interface CreateFabricPayload {
  name: string;
  supplier?: string;
  color?: string;
  pattern: string;
  fabric_type?: string;
  quantity_meters: string | number;
  low_stock_threshold: string | number;
  cost_per_meter: string | number;
  price_per_meter: string | number;
  notes?: string;
  image_url?: string;
}

export async function createFabric(payload: CreateFabricPayload): Promise<Fabric> {
  return api<Fabric>('/api/fabrics/', { method: 'POST', body: payload });
}

export async function updateFabric(
  id: string,
  payload: Partial<CreateFabricPayload> & { is_active?: boolean },
): Promise<Fabric> {
  return api<Fabric>(`/api/fabrics/${id}/`, { method: 'PATCH', body: payload });
}

export interface AdjustPayload {
  delta_meters: number | string;
  kind: UsageKind;
  notes?: string;
}

export async function adjustFabric(
  id: string,
  payload: AdjustPayload,
): Promise<{ fabric: Fabric; usage: FabricUsageEntry }> {
  return api<{ fabric: Fabric; usage: FabricUsageEntry }>(
    `/api/fabrics/${id}/adjust/`,
    { method: 'POST', body: payload },
  );
}
