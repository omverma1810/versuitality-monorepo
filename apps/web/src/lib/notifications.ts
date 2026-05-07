import type { NotificationLogEntry, PaginatedResponse } from '@versuitality/types';

import { api } from './api';

export async function fetchOrderNotifications(
  orderId: string,
): Promise<NotificationLogEntry[]> {
  const data = await api<PaginatedResponse<NotificationLogEntry>>(
    `/api/notifications/?order=${orderId}&limit=100`,
  );
  return data.results;
}
