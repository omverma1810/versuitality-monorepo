import type {
  Order,
  OrderLineItem,
  OrderListItem,
  OrderStats,
  OrderStatus,
  OrderType,
  PaginatedResponse,
} from '@versuitality/types';

import { api, API_BASE } from './api';
import { useAuthStore } from '@/store/authStore';

export interface OrderListParams {
  status?: OrderStatus;
  client?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function listOrders(
  params: OrderListParams = {},
): Promise<PaginatedResponse<OrderListItem>> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  if (!sp.has('limit')) sp.set('limit', '50');
  return api<PaginatedResponse<OrderListItem>>(`/api/orders/?${sp.toString()}`);
}

export async function getOrder(id: string): Promise<Order> {
  return api<Order>(`/api/orders/${id}/`);
}

export async function getOrderStats(): Promise<OrderStats> {
  return api<OrderStats>('/api/orders/stats/');
}

export interface OrderCreatePayload {
  client: string;
  measurement_set?: string | null;
  order_type: OrderType;
  trial_date?: string | null;
  delivery_date?: string | null;
  subtotal?: string | number;
  advance?: string | number;
  notes?: string;
  line_items: OrderLineItem[];
}

export async function createOrder(payload: OrderCreatePayload): Promise<Order> {
  return api<Order>('/api/orders/', { method: 'POST', body: payload });
}

export async function transitionOrder(
  id: string,
  target: OrderStatus,
  reason = '',
): Promise<{ order: Order }> {
  return api<{ order: Order }>(`/api/orders/${id}/transition/`, {
    method: 'POST',
    body: { target, reason },
  });
}

/** Open the order PDF in a new tab. The PDF endpoint requires auth. */
export async function openOrderPdf(order: OrderListItem): Promise<void> {
  const access = useAuthStore.getState().access;
  const res = await fetch(`${API_BASE}/api/orders/${order.id}/pdf/`, {
    headers: access ? { Authorization: `Bearer ${access}` } : undefined,
  });
  if (!res.ok) throw new Error('PDF download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // Hold the URL briefly so the new tab can finish loading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
