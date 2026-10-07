// Part B — the order travels through the atelier: master (production) -> QA (reject, rework, pass)
// -> front desk (delivery) -> accountant (read-only finance view).
import fs from 'node:fs';
import path from 'node:path';

import { BASE, OUT, caption, click, finish, go, launch, login, logout, pause, shot, signIn, type } from './lib.mjs';

const journey = JSON.parse(fs.readFileSync(path.join(OUT, '.journey.json'), 'utf8'));
const { orderPath, orderCode } = journey;

const { browser, context, page } = await launch({ video: true });

const move = async (label, { settle = 1300, note } = {}) => {
  const btn = page.getByRole('button', { name: new RegExp(`Move to\\s*${label}`, 'i') });
  await btn.scrollIntoViewIfNeeded();
  await pause(page, 500);
  if (note) await note();
  await click(btn, { settle });
};

async function passAll() {
  await page.getByRole('heading', { name: 'Quality checklist' }).waitFor();
  const pass = page.getByRole('button', { name: 'Pass', exact: true });
  await pass.first().waitFor();
  const n = await pass.count();
  for (let i = 0; i < n; i++) await click(pass.nth(i), { settle: 140 });
  return n;
}

try {
  // ============================================================ MASTER
  await login(page, 'master');
  await caption(page, 'Imran, the master tailor, signs in. His role sees production, not finance.', 'Production · Master');
  await signIn(page);
  await shot(page, 'b01-dashboard-master', 'Master dashboard', { section: 'Workshop (master)', role: 'master' });

  await go(page, '/orders');
  await caption(page, 'The production board groups every order by its current stage.', 'Production · Master');
  await pause(page, 1500);
  await shot(page, 'b02-orders-board', 'The production board — every order, by stage, live', { section: 'Workshop (master)', role: 'master' });

  await go(page, orderPath);
  await caption(page, `Open ${orderCode}: garments, measurements and the next step he is allowed to take.`, 'Production · Master');
  await pause(page, 1400);
  await shot(page, 'b03-order-master', 'The order as the master sees it — only production steps are offered', { section: 'Workshop (master)', role: 'master' });

  await caption(page, 'Cutting begins.', 'Production · Master');
  await move('Cutting started');
  await shot(page, 'b04-cutting-started', 'After each step the timeline updates for everyone, instantly', { section: 'Workshop (master)', role: 'master' });
  await caption(page, 'Stitching in progress.', 'Production · Master');
  await move('Stitching in progress');
  await caption(page, 'Ready for the client’s trial.', 'Production · Master');
  await move('Ready for trial');
  await shot(page, 'b05-ready-for-trial', 'Ready for trial — the client is notified', { section: 'Workshop (master)', role: 'master' });
  await caption(page, 'After a good trial, the garment goes to quality control.', 'Production · Master');
  await move('Ready for QC');
  await shot(page, 'b06-ready-for-qc', 'Sent to quality control — the master cannot pass his own work', { section: 'Workshop (master)', role: 'master' });

  await go(page, '/inventory');
  await caption(page, 'Fabric used on the order has been deducted from stock automatically.', 'Production · Master');
  await pause(page, 1200);
  await shot(page, 'b07-inventory-master', 'Fabric inventory — metres in stock, low-stock warnings', { section: 'Inventory', role: 'master' });
  await click(page.getByRole('link', { name: /Navy Pinstripe/i }).first());
  await page.waitForLoadState('networkidle');
  await pause(page, 1200);
  await shot(page, 'b08-fabric-ledger', 'A fabric’s movement ledger — every metre in or out, with the order it went to', { section: 'Inventory', role: 'master' });
  await logout(page, 'master');

  // ================================================================ QA
  await login(page, 'qa');
  await caption(page, 'Neha, quality assurance, signs in. She only ever sees orders waiting for inspection.', 'Quality check · QA');
  await signIn(page);
  await go(page, '/qa');
  await pause(page, 1200);
  await shot(page, 'b09-qc-queue', 'The QC queue — only orders the master has marked “Ready for QC”', { section: 'Quality check', role: 'qa' });

  await go(page, orderPath.replace('/orders/', '/qa/'));
  await caption(page, 'A structured checklist — every item must be marked Pass or Fail.', 'Quality check · QA');
  await pause(page, 1200);
  await shot(page, 'b10-qc-checklist', 'The quality checklist', { section: 'Quality check', role: 'qa' });
  const n = await passAll();
  const failBtns = page.getByRole('button', { name: 'Fail', exact: true });
  await caption(page, 'She finds an issue with the lining and fails that one item, with a note for the master.', 'Quality check · QA');
  await click(failBtns.nth(n - 3));
  await type(page.getByPlaceholder('Describe what needs to be redone').first(), 'Lining bunches near the left armhole — re-set the lining.', 24);
  await type(page.getByPlaceholder(/Optional on pass/), 'Everything else is excellent. One lining fix, then re-inspect.', 22);
  await pause(page, 600);
  await shot(page, 'b11-qc-fail-note', 'Failed items need a note, so the master knows exactly what to fix', { section: 'Quality check', role: 'qa' });
  await click(page.getByRole('button', { name: /Reject — start rework/ }), { settle: 900 });
  await shot(page, 'b12-qc-reject-confirm', 'Confirm the rejection — the order goes back to the master', { section: 'Quality check', role: 'qa' });
  await click(page.getByRole('button', { name: 'Confirm reject' }), { settle: 1500 });
  await shot(page, 'b13-qc-rejected-result', 'Rejection recorded', { section: 'Quality check', role: 'qa' });
  await logout(page, 'qa');

  // ===================================================== MASTER (rework)
  await login(page, 'master');
  await caption(page, 'The master sees the rejection and exactly what failed.', 'Rework · Master');
  await signIn(page);
  await go(page, orderPath);
  await pause(page, 1500);
  await shot(page, 'b14-order-qc-rejected', 'The rejected order — the QA reason is on the timeline and failed items are listed', { section: 'Quality check', role: 'master', fullPage: false });
  await page.mouse.wheel(0, 700);
  await pause(page, 800);
  await shot(page, 'b15-order-inspections', 'Inspection history with each failed checklist item', { section: 'Quality check', role: 'master' });
  await page.mouse.wheel(0, -2000);
  await caption(page, 'He fixes the lining, then sends it back for re-inspection.', 'Rework · Master');
  await move('Alteration in progress');
  await move('Ready for QC');
  await logout(page, 'master');

  // ================================================== QA (second pass)
  await login(page, 'qa');
  await signIn(page);
  await go(page, orderPath.replace('/orders/', '/qa/'));
  await caption(page, 'Re-inspection: everything passes.', 'Quality check · QA');
  await pause(page, 800);
  await passAll();
  await pause(page, 600);
  await shot(page, 'b16-qc-all-pass', 'All checklist items passed', { section: 'Quality check', role: 'qa' });
  await click(page.getByRole('button', { name: /Pass — ready for delivery/ }), { settle: 900 });
  await shot(page, 'b17-qc-pass-confirm', 'Confirm the pass — the order becomes “Ready for delivery”', { section: 'Quality check', role: 'qa' });
  await click(page.getByRole('button', { name: 'Confirm pass' }), { settle: 1500 });
  await logout(page, 'qa');

  // ================================================ FRONT DESK (delivery)
  await login(page, 'staff');
  await caption(page, 'Front desk: the order is ready — the client is notified to collect it.', 'Delivery · Front desk');
  await signIn(page);
  await go(page, orderPath);
  await pause(page, 1200);
  await shot(page, 'b18-order-ready-for-delivery', 'Ready for delivery — only front desk can mark it delivered', { section: 'Delivery', role: 'staff' });
  await caption(page, 'The client collects the garment. Mark the order Delivered.', 'Delivery · Front desk');
  await move('Delivered', { settle: 1800 });
  await shot(page, 'b19-order-delivered', 'Delivered — the order is complete and the balance is settled', { section: 'Delivery', role: 'staff' });
  await logout(page, 'staff');

  // ============================================================ ACCOUNTANT
  await login(page, 'accountant');
  await caption(page, 'Vikram, the accountant, sees orders and analytics — read-only.', 'Finance · Accountant');
  await signIn(page);
  await shot(page, 'b20-dashboard-accountant', 'Accountant dashboard', { section: 'Finance (accountant)', role: 'accountant' });
  await go(page, '/orders');
  await pause(page, 1000);
  await shot(page, 'b21-orders-accountant', 'Orders — visible to finance, with no production controls', { section: 'Finance (accountant)', role: 'accountant' });
  await go(page, orderPath);
  await pause(page, 1200);
  await shot(page, 'b22-order-accountant', 'An order from finance’s side — receipt and balance, no status buttons', { section: 'Finance (accountant)', role: 'accountant' });
  await go(page, '/admin/analytics');
  await caption(page, 'Analytics: revenue, quality, stage funnel and top clients.', 'Finance · Accountant');
  await pause(page, 2000);
  await shot(page, 'b23-analytics', 'Analytics — revenue trend, quality outcomes, orders by stage', { section: 'Finance (accountant)', role: 'accountant' });
  await page.mouse.wheel(0, 900);
  await pause(page, 900);
  await shot(page, 'b24-analytics-more', 'Garment mix, top clients and the production funnel', { section: 'Finance (accountant)', role: 'accountant' });
  await page.mouse.wheel(0, -2000);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }).catch(() => null), click(page.getByRole('button', { name: /Export Excel/i }), { settle: 1200 })]);
  if (dl) await dl.saveAs(path.join(OUT, 'orders-export.xlsx'));
  await logout(page, 'accountant');
  await caption(page, '');
  console.log('Part B done');
} catch (e) {
  await page.screenshot({ path: path.join(OUT, '.error-b.png') }).catch(() => {});
  console.error('Part B failed:', e);
  process.exitCode = 1;
} finally {
  await finish(browser, context, page, 'workshop-to-delivery');
}
