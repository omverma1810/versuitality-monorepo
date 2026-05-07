// Cross-package shared types. Domain types are added phase-by-phase as the
// API contracts solidify; this file deliberately starts small.

export type Role = 'admin' | 'staff' | 'master' | 'qa' | 'accountant';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Staff',
  master: 'Master',
  qa: 'QA',
  accountant: 'Accountant',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Owner — full access, finance, analytics',
  staff: 'Front Desk — CRM, measurements, orders',
  master: 'Head Tailor — production status owner',
  qa: 'Quality Assurance — checklist + pass/fail',
  accountant: 'Accountant — read-only, exports',
};

export type OrderStatus =
  | 'order_received'
  | 'requirements_noted'
  | 'cutting_started'
  | 'stitching_in_progress'
  | 'ready_for_trial'
  | 'alteration_in_progress'
  | 'ready_for_qc'
  | 'qc_rejected'
  | 'ready_for_delivery'
  | 'delivered';

export interface ApiHealth {
  status: 'ok';
  service: string;
  time: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  is_superuser?: boolean;
  last_login?: string | null;
  created_at?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface InviteLookup {
  email: string;
  full_name: string;
  role: Role;
  expires_at: string;
}

export interface InvitePayload {
  user: User;
  invite: {
    token: string;
    expires_at: string;
    setup_url: string;
  };
}
