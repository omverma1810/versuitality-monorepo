// Cross-package shared types. Domain types are added phase-by-phase as the
// API contracts solidify; this file deliberately starts small.

export type Role = 'admin' | 'staff' | 'master' | 'qa' | 'accountant';

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
  fullName: string;
  role: Role;
  isActive: boolean;
}
