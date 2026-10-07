// Part C — the owner/admin: team & roles (invite → set password), audit log, orders.
import fs from 'node:fs';
import path from 'node:path';

import { BASE, OUT, caption, click, finish, go, launch, login, logout, pause, shot, signIn, type } from './lib.mjs';

const { orderCode } = JSON.parse(fs.readFileSync(path.join(OUT, '.journey.json'), 'utf8'));
const NEW_PASSWORD = process.env.WALKTHROUGH_NEW_USER_PASSWORD ?? 'Welcome-To-The-Atelier-1!';

const { browser, context, page } = await launch({ video: true });
try {
  await login(page, 'admin');
  await caption(page, 'Arjun, the owner, signs in. Admins see every module.', 'Administration · Owner');
  await signIn(page);
  await shot(page, 'c01-dashboard-admin', 'Owner dashboard — live counts, today’s appointments, low stock, quick actions', { section: 'Administration', role: 'admin' });

  // --------------------------------------------------------- team & roles
  await go(page, '/admin/users');
  await caption(page, 'Team & roles: invite teammates and decide what each person can do.', 'Administration · Team');
  await pause(page, 1500);
  await shot(page, 'c02-team', 'Team & roles — everyone with access, their role, and whether they are active', { section: 'Administration', role: 'admin' });
  await click(page.getByRole('button', { name: /Invite teammate/i }));
  await type(page.getByLabel('Full name'), 'Meera Joshi');
  await type(page.getByLabel('Email'), 'meera.joshi@atelier.demo');
  await click(page.getByRole('button', { name: /^Staff/ }).first(), { settle: 300 });
  await pause(page, 500);
  await shot(page, 'c03-invite', 'Invite a teammate — pick their role', { section: 'Administration', role: 'admin' });
  await click(page.getByRole('button', { name: /Send invitation/i }), { settle: 1500 });
  await pause(page, 1000);
  await shot(page, 'c04-invite-link', 'A one-time setup link — send it to the new teammate', { section: 'Administration', role: 'admin' });
  const body = await page.locator('body').innerText();
  const inputs = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
  const link = [...inputs, body].join(' ').match(/https?:\/\/[^\s"']+setup-password\?token=[\w-]+/)?.[0];
  if (!link) throw new Error('Could not read the invite link');
  await click(page.getByRole('button', { name: 'Close' }), { settle: 500 });
  await logout(page, 'admin');

  // -------------------------------------------------- the invitee sets a password
  await caption(page, 'Meera opens her invitation link and chooses a password.', 'Administration · New teammate');
  const inviteUrl = link.replace(/^https?:\/\/[^/]+/, '');
  await go(page, inviteUrl);
  await pause(page, 1200);
  await shot(page, 'c05-setup-password', 'The invitation page — choose a password (the link works only once)', { section: 'Administration', role: 'all' });
  await type(page.getByLabel('New password'), NEW_PASSWORD, 30);
  await type(page.getByLabel('Confirm password'), NEW_PASSWORD, 30);
  await pause(page, 500);
  await click(page.getByRole('button', { name: /set password|activate|continue|save|create/i }).first(), { settle: 600 });
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await pause(page, 5000);
  await shot(page, 'c06-new-teammate-dashboard', 'The new teammate lands on their own dashboard, already signed in', { section: 'Administration', role: 'staff' });
  await page.getByRole('button', { name: /Meera Joshi/ }).click();
  await click(page.getByRole('button', { name: /sign out/i }), { settle: 300 });
  await page.waitForURL(/\/login/);

  // --------------------------------------------------------------- admin again
  await login(page, 'admin');
  await signIn(page);
  await go(page, '/admin/audit');
  await caption(page, 'Every sign-in, invitation, role change and order step is recorded.', 'Administration · Audit log');
  await pause(page, 1500);
  await shot(page, 'c07-audit-log', 'The audit log — who did what, and when (admin only)', { section: 'Administration', role: 'admin' });

  await go(page, '/orders');
  await caption(page, 'All orders, all stages — including the one we just delivered.', 'Administration · Orders');
  await pause(page, 1500);
  await shot(page, 'c08-orders-admin', 'Orders board for the owner', { section: 'Orders', role: 'admin' });
  await type(page.locator('#app-main').getByPlaceholder(/Search by order ID/i), 'Rahul', 60);
  await pause(page, 1200);
  await shot(page, 'c09-orders-search', 'Search orders by ID, client name or mobile', { section: 'Orders', role: 'admin' });

  await caption(page, '');
  console.log('Part C done');
} catch (e) {
  await page.screenshot({ path: path.join(OUT, '.error-c.png') }).catch(() => {});
  console.error('Part C failed:', e);
  process.exitCode = 1;
} finally {
  await finish(browser, context, page, 'admin-and-team');
}

