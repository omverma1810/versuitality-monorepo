import type {
  Appointment,
  AppointmentKind,
  AppointmentStatus,
  NotifyVia,
  PaginatedResponse,
} from '@versuitality/types';

import { api } from './api';

export interface ListAppointmentsParams {
  status?: AppointmentStatus;
  client?: string;
  from?: string;
  to?: string;
  q?: string;
}

export async function listAppointments(
  params: ListAppointmentsParams = {},
): Promise<PaginatedResponse<Appointment>> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) sp.set(k, String(v));
  });
  sp.set('limit', '100');
  return api<PaginatedResponse<Appointment>>(`/api/appointments/?${sp.toString()}`);
}

export async function fetchTodayAppointments(): Promise<Appointment[]> {
  const data = await api<{ count: number; results: Appointment[] }>(
    '/api/appointments/today/',
  );
  return data.results;
}

export interface CreateAppointmentPayload {
  client?: string | null;
  full_name: string;
  mobile?: string;
  email?: string;
  scheduled_at: string; // ISO
  duration_minutes?: number;
  kind: AppointmentKind;
  notify_via?: NotifyVia;
  notes?: string;
}

export async function createAppointment(
  payload: CreateAppointmentPayload,
): Promise<Appointment> {
  return api<Appointment>('/api/appointments/', { method: 'POST', body: payload });
}

export async function transitionAppointment(
  id: string,
  status: 'completed' | 'cancelled' | 'no_show',
  notes = '',
): Promise<Appointment> {
  return api<Appointment>(`/api/appointments/${id}/transition/`, {
    method: 'POST',
    body: { status, notes },
  });
}
