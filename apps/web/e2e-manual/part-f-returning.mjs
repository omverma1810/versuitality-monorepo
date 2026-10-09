// Part F — a returning customer walks in again: the number alone loads everything.
import path from 'node:path';

import { OUT, caption, click, finish, go, launch, login, pause, shot, signIn, type } from './lib.mjs';

const { browser, context, page } = await launch({ video: true });
try {
  await login(page, 'staff');
  await signIn(page);

  await go(page, '/orders/new');
  await caption(page, 'A returning customer: just type the mobile number — in any format.', 'Returning customer · Front desk');
  await type(page.locator('#app-main').getByPlaceholder(/search by name/i), '98100 10001', 90);
  await page.getByRole('region', { name: 'Returning client' }).waitFor();
  await pause(page, 1500);
  await caption(page, 'The system recognises them: details, latest measurements and past orders appear at once.', 'Returning customer · Front desk');
  await shot(page, 'f01-returning-found', 'Type the mobile number and the customer is recognised: profile, latest measurements and previous orders load automatically', { section: 'Returning customers', role: 'staff' });

  const repeat = page.getByRole('button', { name: /^Repeat order/ }).first();
  await click(repeat, { settle: 900 });
  await caption(page, 'Repeat a previous order with one click — garments, fabric, prices and notes are copied.', 'Returning customer · Front desk');
  await pause(page, 1200);
  await shot(page, 'f02-repeat-order', 'Repeat order: the earlier garments, fabric, prices and notes are copied for review — nothing is saved until you confirm', { section: 'Returning customers', role: 'staff' });
  await click(page.getByRole('button', { name: /continue/i }));
  await pause(page, 1200);
  await caption(page, 'The newest measurements are already linked to the order.', 'Returning customer · Front desk');
  await shot(page, 'f03-measurements-linked', 'The latest measurement set is pre-selected — no need to measure again unless the client has changed', { section: 'Returning customers', role: 'staff' });

  await go(page, '/orders/new');
  await caption(page, 'A number that is not on file is a new customer.', 'New customer · Front desk');
  await type(page.locator('#app-main').getByPlaceholder(/search by name/i), '98765 43210', 90);
  await page.getByText(/new customer — no one is registered/i).waitFor();
  await pause(page, 1000);
  await shot(page, 'f04-new-customer', 'An unknown number offers “Register this customer” and carries the number across', { section: 'Returning customers', role: 'staff' });

  await go(page, '/clients/new');
  await caption(page, 'Registering an existing number is blocked — one person, one profile.', 'Returning customer · Front desk');
  await type(page.getByLabel('Full name'), 'Aarav M');
  await type(page.getByLabel('Mobile (WhatsApp)'), '9810010001', 80);
  await page.getByRole('alert').filter({ hasText: /already registered/i }).waitFor();
  await pause(page, 1200);
  await shot(page, 'f05-duplicate-blocked', 'Registering a number that already belongs to a customer is blocked and points to their profile', { section: 'Returning customers', role: 'staff' });

  const link = page.getByRole('link', { name: /start a new order for/i }).first();
  const href = await link.getAttribute('href');
  const clientId = href.split('client=')[1];
  await go(page, `/clients/${clientId}/measurements/new?returnTo=${encodeURIComponent(`/orders/new?client=${clientId}`)}`);
  await caption(page, 'Re-measuring? The form starts from the last visit — change only what differs.', 'Returning customer · Front desk');
  await pause(page, 1500);
  await shot(page, 'f06-measurements-prefilled', 'Taking new measurements starts from the previous visit; the earlier set stays on record', { section: 'Returning customers', role: 'staff' });
  await caption(page, '');
  console.log('Part F done');
} catch (e) {
  await page.screenshot({ path: path.join(OUT, '.error-f.png') }).catch(() => {});
  console.error('Part F failed:', e);
  process.exitCode = 1;
} finally {
  await finish(browser, context, page, 'returning-customer');
}
