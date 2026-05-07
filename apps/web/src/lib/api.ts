/**
 * Authenticated fetch client.
 *
 * Reads the access token from the auth store, attaches it as a Bearer token,
 * and on 401 attempts a single refresh-then-retry cycle. If refresh fails the
 * store is cleared and the client is redirected to /login.
 */
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const { refresh, clear, setTokens } = useAuthStore.getState();
  if (!refresh) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clear();
        return null;
      }
      const data = (await res.json()) as { access: string; refresh?: string };
      setTokens({ access: data.access, refresh: data.refresh ?? refresh });
      return data.access;
    } catch {
      clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

export async function api<T = unknown>(
  path: string,
  { body, auth = true, headers, ...rest }: ApiOptions = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const buildHeaders = (token?: string | null): HeadersInit => {
    const h: Record<string, string> = {
      Accept: 'application/json',
      ...(headers as Record<string, string> | undefined),
    };
    if (body !== undefined && !(body instanceof FormData)) {
      h['Content-Type'] = 'application/json';
    }
    if (auth && token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const send = async (token?: string | null) => {
    const init: RequestInit = {
      ...rest,
      headers: buildHeaders(token),
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'include',
    };
    return fetch(url, init);
  };

  const initialToken = auth ? useAuthStore.getState().access : null;
  let res = await send(initialToken);

  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await send(newToken);
    } else if (typeof window !== 'undefined' && !path.includes('/auth/login')) {
      window.location.href = '/login';
    }
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'detail' in data
        ? String((data as Record<string, unknown>).detail)
        : `Request failed (${res.status})`);
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

export const API_BASE = API_BASE_URL;
