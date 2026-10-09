// Part E — changing and cancelling an order (front desk). Uses its own throwaway orders.
import path from 'node:path';

import { API, OUT, PASSWORD, TEAM, caption, click, finish, go, launch, login, pause, shot, signIn, type } from './lib.mjs';

async function apiJson(method, route, token, body) {
  const res = await fetch(`${API}/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const token = (await apiJson('POST', '/auth/login/', null, { email: TEAM.staff.email, password: PASSWORD })).tokens.access;
const mk = async (name, mobile, price) => {
  const c = await apiJson('POST', '/clients/', token, { full_name: name, mobile });
  return apiJson('POST', '/orders/', token, { client: c.id, order_type: 'full', advance: 0,
    line_items: [{ garment_type: 'suit', quantity: 1, unit_price: price, fabric_description: 'Charcoal herringbone' }] });
};
const stamp = String(Date.now()).slice(-6);
const toEdit = await mk('Sameer Khanna', `+9198111${stamp}`, '36000');
const toCancel = await mk('Dev Malhotra', `+9198222${stamp}`, '28000');

const { browser, context, page } = await launch({ video: true });
try {
  await login(page, 'staff');
  await signIn(page);

  await go(page, `/orders/${toEdit.id}`);
  await caption(page, 'Plans change. Open the order and choose “Edit order”.', 'Changing an order · Front desk');
  await pause(page, 1200);
  await shot(page, 'e01-order-edit-cancel-buttons', 'Front desk and admins see “Edit order” and “Cancel order” on every order that is not finished', { section: 'Changing or cancelling an order', role: 'staff' });
  await click(page.getByRole('link', { name: /edit order/i }));
  await page.waitForLoadState('networkidle');
  await pause(page, 1000);

  await caption(page, 'Before cutting starts, garments, prices, dates and payments can all change.', 'Changing an order · Front desk');
  await type(page.getByLabel('Unit price').first(), '38500', 50);
  const inTen = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel('Delivery date').fill(inTen);
  await type(page.getByLabel('Paid so far (advance)'), '15000', 50);
  await type(page.locator('#order-notes'), 'Client wants a slightly longer jacket — confirmed by phone.', 20);
  await pause(page, 700);
  await shot(page, 'e02-order-edit-form', 'The edit page: garments, price, dates, payment and notes (the new total is shown as you type)', { section: 'Changing or cancelling an order', role: 'staff' });
  await click(page.getByRole('button', { name: /save changes/i }), { settle: 300 });
  await page.waitForURL(/edited=1/);
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);
  await shot(page, 'e03-order-edited', 'Saved — the total, balance and notes are updated and the change is recorded in the audit log', { section: 'Changing or cancelling an order', role: 'staff' });

  await go(page, `/orders/${toCancel.id}`);
  await caption(page, 'If the client withdraws the order, choose “Cancel order” — a reason is required.', 'Cancelling an order · Front desk');
  await pause(page, 900);
  await click(page.getByRole('button', { name: /cancel order/i }));
  await type(page.getByPlaceholder(/why is this order/i), 'Client travelling abroad — will re-order next season.', 24);
  await pause(page, 600);
  await shot(page, 'e04-order-cancel-dialog', 'Cancelling asks for a reason (and offers to return tracked fabric to stock)', { section: 'Changing or cancelling an order', role: 'staff' });
  await click(page.getByRole('dialog').getByRole('button', { name: /^cancel order$/i }), { settle: 1500 });
  await pause(page, 1200);
  await shot(page, 'e05-order-cancelled', 'A cancelled order stays on record with who cancelled it and why, but leaves production and the revenue figures', { section: 'Changing or cancelling an order', role: 'staff' });
  await caption(page, '');
  console.log('Part E done');
} catch (e) {
  await page.screenshot({ path: path.join(OUT, '.error-e.png') }).catch(() => {});
  console.error('Part E failed:', e);
  process.exitCode = 1;
} finally {
  await finish(browser, context, page, 'edit-and-cancel');
}
