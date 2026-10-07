// Part D — owner operations: inventory, appointments, clients, global search, analytics,
// then a phone-sized pass (no video).
import fs from 'node:fs';
import path from 'node:path';

import { OUT, caption, click, finish, go, launch, login, pause, shot, signIn, type } from './lib.mjs';

const { browser, context, page } = await launch({ video: true });
try {
  await login(page, 'admin');
  await signIn(page);

  // ------------------------------------------------------------- inventory
  await go(page, '/inventory/new');
  await caption(page, 'Inventory: add a new bolt of fabric.', 'Administration · Inventory');
  await type(page.getByPlaceholder(/Italian wool/), 'Merino Wool — Charcoal Herringbone', 25);
  await type(page.getByPlaceholder(/Loro Piana/), 'Vitale Barberis Canonico', 25);
  await type(page.getByPlaceholder('Navy', { exact: true }), 'Charcoal', 40);
  await type(page.getByPlaceholder(/Wool · Cotton/), 'Wool', 40);
  const nums = page.locator('main input[type="number"]');
  await type(nums.nth(0), '24', 60);
  await type(nums.nth(2), '3600', 60);
  await type(nums.nth(3), '5800', 60);
  await pause(page, 600);
  await shot(page, 'c10-fabric-new', 'Add a fabric — supplier, colour, opening stock and pricing', { section: 'Inventory', role: 'admin' });
  await click(page.getByRole('button', { name: /add fabric|save|create/i }).last(), { settle: 1500 });
  await page.waitForURL(/\/inventory\/[0-9a-f-]{36}/, { timeout: 15000 }).catch(() => {});
  await pause(page, 1200);
  await type(page.getByPlaceholder('0.0'), '12', 60);
  await type(page.getByPlaceholder(/Optional note/), 'Restock — PO 1042', 25);
  await click(page.getByRole('button', { name: /Stock in/i }), { settle: 1400 });
  await shot(page, 'c11-fabric-restock', 'Stock in / stock out — each movement is logged in the ledger', { section: 'Inventory', role: 'admin' });

  // ---------------------------------------------------------- appointments
  await go(page, '/appointments/new');
  await caption(page, 'Book the client’s trial — they can be reminded by WhatsApp or email.', 'Administration · Appointments');
  await type(page.locator('#app-main').getByPlaceholder(/Search by name/i), 'Rahul', 70);
  await pause(page, 900);
  await click(page.locator('#app-main').getByRole('button', { name: /Rahul Verma/ }).first());
  const when = new Date(Date.now() + 7 * 864e5);
  when.setHours(17, 0, 0, 0);
  const local = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.locator('input[type="datetime-local"]').fill(local);
  await click(page.getByRole('button', { name: /^Trial fitting$/ }), { settle: 300 });
  await pause(page, 600);
  await shot(page, 'c12-appointment-new', 'Book an appointment — consultation, measurement, trial or delivery', { section: 'Appointments', role: 'staff' });
  await click(page.getByRole('button', { name: /Schedule appointment/i }), { settle: 1500 });
  await go(page, '/appointments');
  await pause(page, 1200);
  await shot(page, 'c13-appointments-list', 'The appointment list — upcoming visits at a glance', { section: 'Appointments', role: 'staff' });

  // --------------------------------------------------------------- clients
  await go(page, '/clients');
  await pause(page, 1000);
  await shot(page, 'c14-clients-list', 'Clients — find anyone by name, mobile or ID', { section: 'Clients', role: 'staff' });
  await type(page.getByPlaceholder(/search/i).last(), 'Rahul', 60);
  await pause(page, 1200);
  await shot(page, 'c15-clients-search', 'Client search narrows the list as you type', { section: 'Clients', role: 'staff' });

  // ---------------------------------------------------------- global search
  await go(page, '/dashboard');
  await caption(page, 'The search bar at the top finds clients from anywhere — press Ctrl/⌘ + K.', 'Tips · Global search');
  await page.keyboard.press('Control+k');
  await pause(page, 500);
  await page.keyboard.type('Rahul', { delay: 120 });
  await pause(page, 1500);
  await shot(page, 'c16-global-search', 'Global search (Ctrl/⌘ + K) — jump straight to a client', { section: 'Tips', role: 'all' });
  await page.keyboard.press('Escape');

  await go(page, '/admin/analytics');
  await caption(page, 'Analytics for the owner: revenue, quality and production funnel.', 'Administration · Analytics');
  await pause(page, 2500);
  await shot(page, 'c17-analytics-admin', 'Analytics — pick any date range and export to Excel', { section: 'Administration', role: 'admin' });
  await caption(page, '');
  console.log('Part D (desktop) done');
} catch (e) {
  await page.screenshot({ path: path.join(OUT, '.error-d.png') }).catch(() => {});
  console.error('Part D failed:', e);
  process.exitCode = 1;
} finally {
  await finish(browser, context, page, 'owner-operations');
}

// -------------------------------------------------------------- phone-sized pass
{
  const { browser: b2, context: c2, page: p2 } = await launch({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    await login(p2, 'staff');
    await p2.getByRole('button', { name: /sign in/i }).click();
    await p2.waitForURL(/\/dashboard/);
    await p2.waitForLoadState('networkidle');
    await pause(p2, 5000);
    await shot(p2, 'm01-mobile-dashboard', 'On a phone — the dashboard with the bottom navigation bar', { section: 'On your phone', role: 'staff' });
    await go(p2, '/orders');
    await pause(p2, 1200);
    await shot(p2, 'm02-mobile-orders', 'Orders on a phone', { section: 'On your phone', role: 'staff' });
    await go(p2, '/clients/new');
    await pause(p2, 1000);
    await shot(p2, 'm03-mobile-intake', 'Register a client on a phone or tablet at the counter', { section: 'On your phone', role: 'staff' });
    console.log('Part C (mobile) done');
  } catch (e) {
    await p2.screenshot({ path: path.join(OUT, '.error-c-mobile.png') }).catch(() => {});
    console.error('Mobile pass failed:', e);
    process.exitCode = 1;
  } finally {
    await finish(b2, c2, p2, 'mobile-unused');
    fs.rmSync(path.join(OUT, 'videos', 'mobile-unused.webm'), { force: true });
  }
}
