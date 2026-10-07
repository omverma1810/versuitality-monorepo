import { expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD ?? '';
export const API = process.env.E2E_API_URL ?? 'http://localhost:8000';

export type RoleName = 'admin' | 'staff' | 'master' | 'qa' | 'accountant';

export const emailFor = (role: RoleName) => `${role}@e2e.versuitality.test`;

/** Sign in through the real login form. */
export async function login(page: Page, role: RoleName) {
  expect(PASSWORD, 'E2E_PASSWORD must be set').not.toEqual('');
  await page.goto('/login');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|orders|clients|qa|admin)/, { timeout: 20_000 });
}

const tokens = new Map<RoleName, string>();

/** Direct API session for fast, non-UI fixture setup. */
export async function apiToken(role: RoleName): Promise<string> {
  const cached = tokens.get(role);
  if (cached) return cached;
  const res = await fetch(`${API}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailFor(role), password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed for ${role}: ${res.status}`);
  const body = await res.json();
  tokens.set(role, body.tokens.access);
  return body.tokens.access;
}

export async function apiCall<T = any>(role: RoleName, method: string, path: string, data?: unknown): Promise<T> {
  const token = await apiToken(role);
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function apiStatus(role: RoleName, method: string, path: string, data?: unknown): Promise<number> {
  const token = await apiToken(role);
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: data ? JSON.stringify(data) : undefined,
  });
  return res.status;
}

/** Unique-ish Indian mobile so reruns against the same DB don't collide. */
export const uniqueMobile = () => `+9198${String(Date.now()).slice(-8)}`;
