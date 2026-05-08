import type { AnalyticsSummary } from '@versuitality/types';

import { api, API_BASE } from './api';
import { useAuthStore } from '@/store/authStore';

export interface AnalyticsParams {
  from?: string;
  to?: string;
}

function build(params: AnalyticsParams): string {
  const sp = new URLSearchParams();
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  return sp.toString();
}

export async function fetchAnalyticsSummary(
  params: AnalyticsParams = {},
): Promise<AnalyticsSummary> {
  const qs = build(params);
  return api<AnalyticsSummary>(`/api/analytics/summary/${qs ? '?' + qs : ''}`);
}

/** Triggers download of the date-range orders workbook. */
export async function downloadOrdersXlsx(params: AnalyticsParams = {}): Promise<void> {
  const access = useAuthStore.getState().access;
  const qs = build(params);
  const res = await fetch(
    `${API_BASE}/api/analytics/orders.xlsx/${qs ? '?' + qs : ''}`,
    { headers: access ? { Authorization: `Bearer ${access}` } : undefined },
  );
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `versuitality_orders_${params.from ?? 'all'}_to_${params.to ?? 'today'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
