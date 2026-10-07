import type { PaginatedResponse } from '@versuitality/types';

import { api } from './api';

export interface AuditEntry {
  id: string;
  action: string;
  actor_name: string;
  actor_email: string;
  target_name: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  user_invited: 'Invited a team member',
  user_activated: 'Activated an account',
  user_deactivated: 'Deactivated an account',
  user_role_changed: 'Changed a role',
  password_set: 'Set a password',
  password_reset: 'Reset a password',
  order_status_changed: 'Moved an order',
};

export async function fetchAuditLog(params: {
  action?: string;
  q?: string;
  offset?: number;
  limit?: number;
}): Promise<PaginatedResponse<AuditEntry>> {
  const sp = new URLSearchParams();
  if (params.action) sp.set('action', params.action);
  if (params.q) sp.set('q', params.q);
  sp.set('limit', String(params.limit ?? 25));
  sp.set('offset', String(params.offset ?? 0));
  return api<PaginatedResponse<AuditEntry>>(`/api/audit/?${sp.toString()}`);
}
