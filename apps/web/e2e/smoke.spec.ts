import { expect, test, type Page } from '@playwright/test';

import { apiCall, login, uniqueMobile, type RoleName } from './helpers';

/** Every page a role can open must load without any failing API call (no 4xx/5xx noise). */
const PAGES: Record<RoleName, string[]> = {
  admin: ['/dashboard', '/clients', '/orders', '/qa', '/appointments', '/inventory', '/admin/users', '/admin/analytics', '/admin/audit'],
  staff: ['/dashboard', '/clients', '/clients/new', '/orders', '/orders/new', '/appointments', '/appointments/new', '/inventory'],
  master: ['/dashboard', '/clients', '/orders', '/inventory'],
  qa: ['/dashboard', '/orders', '/qa'],
  accountant: ['/dashboard', '/orders', '/admin/analytics'],
};

function trackFailures(page: Page) {
  const failures: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) failures.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  return failures;
}

test.describe('every role can open every page it is shown, without API errors', () => {
  let orderId = '';
  test.beforeAll(async () => {
    const client = await apiCall<{ id: string }>('staff', 'POST', '/clients/', { full_name: 'Smoke Client', mobile: uniqueMobile() });
    const order = await apiCall<{ id: string }>('staff', 'POST', '/orders/', {
      client: client.id,
      order_type: 'full',
      line_items: [{ garment_type: 'shirt', quantity: 1, unit_price: '5000' }],
    });
    orderId = order.id;
  });

  for (const role of Object.keys(PAGES) as RoleName[]) {
    test(`${role}`, async ({ page }) => {
      const failures = trackFailures(page);
      await login(page, role);
      // QA only sees orders awaiting inspection, so a fresh order is (correctly) hidden from them.
      for (const path of role === 'qa' ? PAGES[role] : [...PAGES[role], '__order__']) {
        const target = path === '__order__' ? `/orders/${orderId}` : path;
        await page.goto(target);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main, #app-main').first()).toBeVisible();
        await expect(page.getByText(/application error|something went wrong/i)).toHaveCount(0);
      }
      expect(failures, `API/JS errors for ${role}`).toEqual([]);
    });
  }
});
