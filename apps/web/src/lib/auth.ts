import { api } from './api';
import { useAuthStore } from '@/store/authStore';
import type {
  InviteLookup,
  LoginResponse,
  User,
} from '@versuitality/types';

export async function login(email: string, password: string): Promise<User> {
  const resp = await api<LoginResponse>('/api/auth/login/', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  useAuthStore.getState().setSession(resp);
  return resp.user;
}

export async function logout(): Promise<void> {
  const { refresh } = useAuthStore.getState();
  try {
    await api('/api/auth/logout/', {
      method: 'POST',
      body: refresh ? { refresh } : undefined,
    });
  } catch {
    /* fall through — we'll clear locally regardless */
  }
  useAuthStore.getState().clear();
}

export async function fetchMe(): Promise<User> {
  const me = await api<User>('/api/auth/me/');
  useAuthStore.getState().setUser(me);
  return me;
}

export async function lookupInvite(token: string): Promise<InviteLookup> {
  return api<InviteLookup>(`/api/auth/invite/${encodeURIComponent(token)}/`, {
    auth: false,
  });
}

export async function setupPassword(
  token: string,
  password: string,
  passwordConfirm: string,
): Promise<LoginResponse> {
  const resp = await api<LoginResponse>('/api/auth/setup-password/', {
    method: 'POST',
    body: { token, password, password_confirm: passwordConfirm },
    auth: false,
  });
  useAuthStore.getState().setSession(resp);
  return resp;
}
