import type {
  OrderListItem,
  PaginatedResponse,
  QcChecklistItemDef,
  QcChecklistResponse,
  QcInspection,
  QcOutcome,
} from '@versuitality/types';

import { api } from './api';

export async function fetchQcQueue(): Promise<{
  count: number;
  results: OrderListItem[];
}> {
  return api<{ count: number; results: OrderListItem[] }>('/api/qa/queue/');
}

export async function fetchChecklistItems(): Promise<QcChecklistItemDef[]> {
  const data = await api<{ items: QcChecklistItemDef[] }>('/api/qa/checklist/');
  return data.items;
}

export async function fetchInspections(
  orderId: string,
): Promise<PaginatedResponse<QcInspection>> {
  return api<PaginatedResponse<QcInspection>>(
    `/api/qa/inspections/?order=${orderId}`,
  );
}

export interface SubmitInspectionPayload {
  order: string;
  outcome: QcOutcome;
  overall_comment?: string;
  checklist: Record<string, QcChecklistResponse>;
}

export async function submitInspection(
  payload: SubmitInspectionPayload,
): Promise<QcInspection> {
  return api<QcInspection>('/api/qa/inspections/submit/', {
    method: 'POST',
    body: payload,
  });
}
