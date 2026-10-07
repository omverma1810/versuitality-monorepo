// Part A — a client walks into the atelier. Front-desk staff (Priya) registers them,
// captures measurements, writes the order and hands over the receipt.
import fs from 'node:fs';
import path from 'node:path';

import { API, BASE, IMAGES, OUT, PASSWORD, TEAM, caption, click, finish, go, launch, login, pause, shot, signIn, type } from './lib.mjs';

const CLIENT = { name: 'Rahul Verma', mobile: '+91 98200 55123', email: 'rahul.verma@example.com' };

const { browser, context, page } = await launch({ video: true });
try {
  // ---------------------------------------------------------------- sign in
  await go(page, '/login');
  await caption(page, 'The front-desk team signs in with their own email and password.', 'Step 1 · Sign in');
  await pause(page, 1200);
  await shot(page, 'a01-login', 'The sign-in screen', { section: 'Getting started', role: 'all' });
  await login(page, 'staff');
  await shot(page, 'a02-login-filled', 'Enter your work email and password', { section: 'Getting started', role: 'all' });
  await signIn(page);

  await caption(page, 'The dashboard shows today’s appointments, live counts and low-stock alerts.', 'Step 1 · Sign in');
  await pause(page, 1500);
  await shot(page, 'a03-dashboard-staff', 'Your dashboard — what needs attention today', { section: 'Front desk', role: 'staff' });

  // ----------------------------------------------------- today's appointments
  await caption(page, 'Check who is booked in today.', 'Step 2 · The client arrives');
  await go(page, '/appointments');
  await pause(page, 1200);
  await shot(page, 'a04-appointments', 'Appointments — the day at a glance', { section: 'Front desk', role: 'staff' });

  // ------------------------------------------------------ register new client
  await caption(page, 'A new walk-in: open “Register a client”.', 'Step 3 · Register the client');
  await go(page, '/clients/new');
  await pause(page, 900);
  await type(page.getByLabel('Full name'), CLIENT.name);
  await type(page.getByLabel('Mobile (WhatsApp)'), CLIENT.mobile);
  await type(page.getByLabel('Email'), CLIENT.email);
  await pause(page, 600);
  await shot(page, 'a05-client-contact', 'Step 1 of 4 — contact details (the mobile number is the client’s identity)', { section: 'Registering a client', role: 'staff' });
  await click(page.getByRole('button', { name: /continue/i }));

  await caption(page, 'Style preferences help the master and the front desk remember the client.', 'Step 3 · Register the client');
  // pick a few preference chips (occasions + fabrics)
  const chips = page.locator('main button[type="button"]').filter({ hasText: /^(Wedding|Formal|Business|Wool|Linen|Cotton)$/ });
  for (const label of ['Wedding', 'Business', 'Wool']) {
    const c = page.locator('main button[type="button"]', { hasText: new RegExp(`^${label}$`) }).first();
    if (await c.count()) await click(c, { settle: 250 });
  }
  void chips;
  const notes = page.locator('main textarea').last();
  if (await notes.count()) await type(notes, 'Prefers a slim taper. Right shoulder slightly higher.', 22);
  await pause(page, 600);
  await shot(page, 'a06-client-preferences', 'Step 2 of 4 — style preferences and notes', { section: 'Registering a client', role: 'staff' });
  await click(page.getByRole('button', { name: /continue/i }));

  // ------------------------------------------------------------ measurements
  await caption(page, 'Capture measurements digitally — in inches, to the half inch.', 'Step 4 · Measurements');
  await click(page.getByRole('button', { name: 'Suit', exact: true }));
  await click(page.getByRole('button', { name: 'Shirt', exact: true }), { settle: 250 });
  const m = async (label, value) => type(page.getByLabel(label).first(), String(value), 60);
  await m('Length', '30');
  await m('Shoulder', '18');
  await m('Sleeve', '25.5');
  await m('Chest', '40');
  await m('Waist', '34');
  await m('Collar', '15.5');
  await pause(page, 600);
  await shot(page, 'a07-measurements', 'Step 3 of 4 — the measurement sheet (the figure highlights the point being measured)', { section: 'Measurements', role: 'staff', fullPage: false });
  await page.mouse.wheel(0, 1100);
  await pause(page, 700);
  await shot(page, 'a08-measurements-fabric', 'Fabric notes, customisation and a photo of the cloth swatch', { section: 'Measurements', role: 'staff' });
  await page.mouse.wheel(0, -2000);
  await click(page.getByRole('button', { name: /continue/i }));

  await caption(page, 'Review everything with the client, then save.', 'Step 3 · Register the client');
  await pause(page, 1200);
  await shot(page, 'a09-client-review', 'Step 4 of 4 — review before saving', { section: 'Registering a client', role: 'staff' });
  await click(page.getByRole('button', { name: /save client/i }), { settle: 300 });
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}/);
  await page.waitForLoadState('networkidle');
  await pause(page, 1500);
  await caption(page, 'The client now has a profile with a unique ID and their measurement history.', 'Step 3 · Register the client');
  await shot(page, 'a10-client-profile', 'The client profile — ID, contact, preferences and measurement history', { section: 'Registering a client', role: 'staff' });
  const clientUrl = new URL(page.url()).pathname;

  // measurement history tab
  const mt = page.getByRole('button', { name: /^Measurements/ }).or(page.getByRole('tab', { name: /^Measurements/ }));
  if (await mt.count()) {
    await click(mt.first());
    await pause(page, 800);
    await shot(page, 'a11-client-measurements', 'Measurement history — every visit is kept, newest first (with Excel export)', { section: 'Measurements', role: 'staff' });
  }

  // ------------------------------------------------------------ create order
  await caption(page, 'Now write up the order.', 'Step 5 · Create the order');
  await go(page, '/orders/new');
  await type(page.locator('#app-main').getByPlaceholder(/Search by name/i), 'Rahul', 70);
  await pause(page, 900);
  await shot(page, 'a12-order-client', 'Order step 1 — find the client by name, mobile or ID', { section: 'Creating an order', role: 'staff' });
  await click(page.locator('#app-main').getByRole('button', { name: /Rahul Verma/ }).first());
  await pause(page, 600);
  await click(page.getByRole('button', { name: /continue/i }));

  // line 1: Suit with tracked fabric
  const selects = () => page.locator('main select');
  await selects().nth(0).selectOption('suit');
  await type(page.getByPlaceholder(/Fabric \(e\.g\./).nth(0), 'Italian wool, navy pinstripe', 30);
  const fabricSel = selects().nth(1);
  const opts = await fabricSel.locator('option').allTextContents();
  const navy = opts.findIndex((t) => /Navy Pinstripe/i.test(t));
  if (navy > 0) {
    await fabricSel.selectOption({ index: navy });
    const meters = page.locator('main input[placeholder="—"]').first();
    if (await meters.count()) await type(meters, '3.5', 60);
  }
  await type(page.getByPlaceholder('Unit price').nth(0), '38000', 60);
  // line 2: Shirt
  await click(page.getByRole('button', { name: /add line/i }));
  await selects().nth(2).selectOption('shirt').catch(() => {});
  await type(page.getByPlaceholder(/Fabric \(e\.g\./).nth(1), 'Egyptian cotton, white', 30);
  await type(page.getByPlaceholder('Unit price').nth(1), '4500', 60);
  await pause(page, 700);
  await caption(page, 'Add each garment as a line — pick tracked fabric to deduct stock automatically.', 'Step 5 · Create the order');
  await shot(page, 'a13-order-garments', 'Order step 2 — garments, fabric and price (tracked fabric is deducted from stock)', { section: 'Creating an order', role: 'staff' });
  await click(page.getByRole('button', { name: /continue/i }));

  await caption(page, 'Link the measurements taken today so the master has them on the receipt.', 'Step 5 · Create the order');
  await pause(page, 900);
  const mset = page.locator('main button[type="button"]').filter({ hasText: /Shirt|Suit|measure/i }).first();
  if (await mset.count()) await click(mset);
  await shot(page, 'a14-order-measurements', 'Order step 3 — link the measurement set from this visit', { section: 'Creating an order', role: 'staff' });

  const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const inOneWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel('Trial date').scrollIntoViewIfNeeded();
  await page.getByLabel('Trial date').fill(inOneWeek);
  await page.getByLabel('Delivery date').fill(inTwoWeeks);
  await type(page.getByLabel('Advance paid'), '20000', 60);
  await caption(page, 'Set the trial and delivery dates and record the advance.', 'Step 5 · Create the order');
  await pause(page, 700);
  await shot(page, 'a15-order-schedule', 'Order step 3 — trial and delivery dates, advance paid, notes', { section: 'Creating an order', role: 'staff' });
  await click(page.getByRole('button', { name: /continue/i }));

  await pause(page, 900);
  await shot(page, 'a16-order-review', 'Order step 4 — review the total and confirm', { section: 'Creating an order', role: 'staff' });
  await click(page.getByRole('button', { name: /create order/i }), { settle: 300 });
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}/);
  await page.waitForLoadState('networkidle');
  await pause(page, 2200);
  await caption(page, 'Order confirmed. It receives its own ID — VS-YYYYMMDD-XXXX — and appears on every dashboard instantly.', 'Step 5 · Create the order');
  await shot(page, 'a17-order-created', 'Order confirmed — ID, garments, balance due and the full status timeline', { section: 'Creating an order', role: 'staff' });
  const orderPath = new URL(page.url()).pathname;
  const orderId = orderPath.split('/').pop();
  const orderCode = (await page.getByText(/VS-\d{8}-\d{4}/).first().textContent()).match(/VS-\d{8}-\d{4}/)[0];

  // ------------------------------------------------------------ PDF receipt
  await caption(page, 'Print or share the PDF receipt — it carries the measurements for the workshop.', 'Step 6 · Hand over the receipt');
  const token = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('versuitality-auth') || '';
      return JSON.parse(raw)?.state?.access ?? null;
    } catch { return null; }
  });
  void token;
  const [pdfResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/pdf/')),
    click(page.getByRole('button', { name: /PDF receipt/i }), { settle: 800 }),
  ]);
  const pdfBody = await pdfResp.body().catch(() => null);
  if (pdfBody && pdfBody.length > 100) fs.writeFileSync(path.join(OUT, 'receipt.pdf'), pdfBody);
  await pause(page, 800);

  // -------------------------------------------- staff notes the requirements
  await page.bringToFront();
  await caption(page, 'Front desk moves the order to “Requirements noted” — the master is notified live.', 'Step 7 · Hand over to the workshop');
  const noteBtn = page.getByRole('button', { name: /Move to\s*Requirements noted/i });
  await noteBtn.scrollIntoViewIfNeeded();
  await pause(page, 600);
  await shot(page, 'a18-order-actions', 'The “Update status” panel only offers the steps your role may take', { section: 'Creating an order', role: 'staff' });
  await click(noteBtn, { settle: 1200 });
  await page.mouse.wheel(0, 600);
  await pause(page, 1200);
  await shot(page, 'a19-order-timeline-notified', 'The timeline records who moved the order, and the client’s notifications are logged', { section: 'Creating an order', role: 'staff', fullPage: false });

  fs.writeFileSync(path.join(OUT, '.journey.json'), JSON.stringify({ orderId, orderCode, orderPath, clientUrl }, null, 2));
  await caption(page, '');
  console.log('Part A done:', orderCode);
} catch (e) {
  await page.screenshot({ path: path.join(OUT, '.error-a.png') }).catch(() => {});
  console.error('Part A failed:', e);
  process.exitCode = 1;
} finally {
  await finish(browser, context, page, 'client-journey');
}
