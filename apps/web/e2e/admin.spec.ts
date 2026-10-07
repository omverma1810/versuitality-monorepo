import { expect, test } from '@playwright/test';

import { apiStatus, login } from './helpers';

test.describe('administration', () => {
  test('admin can open team, analytics and the audit log', async ({ page }) => {
    await login(page, 'admin');

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /team/i }).first()).toBeVisible();
    await expect(page.getByText('anita@e2e.versuitality.test').or(page.getByText('admin@e2e.versuitality.test')).first()).toBeVisible();

    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i }).first()).toBeVisible();

    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(page.locator('tbody').getByText('Signed in').first()).toBeVisible();
  });

  test('accountant reaches analytics but not team or audit pages', async ({ page }) => {
    await login(page, 'accountant');
    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i }).first()).toBeVisible();
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/);
    await page.goto('/admin/audit');
    await expect(page).not.toHaveURL(/\/admin\/audit/);
  });

  test('staff are bounced from every admin page', async ({ page }) => {
    await login(page, 'staff');
    for (const path of ['/admin/users', '/admin/analytics', '/admin/audit', '/qa']) {
      await page.goto(path);
      await expect(page, path).not.toHaveURL(new RegExp(path.replace('/', '\\/')));
    }
  });
});

/** The API is the real gate: UI hiding alone is not security. */
test.describe('API enforces roles directly', () => {
  const cases: Array<[string, 'admin' | 'staff' | 'master' | 'qa' | 'accountant', string, number]> = [
    ['staff', 'staff', '/audit/', 403],
    ['qa', 'qa', '/clients/', 403],
    ['accountant', 'accountant', '/clients/', 403],
    ['accountant', 'accountant', '/fabrics/', 403],
    ['master', 'master', '/analytics/summary/', 403],
    ['qa', 'qa', '/users/', 403],
    ['admin', 'admin', '/audit/', 200],
    ['accountant', 'accountant', '/analytics/summary/', 200],
    ['master', 'master', '/clients/', 200],
  ];
  for (const [label, role, path, expected] of cases) {
    test(`${label} → GET ${path} is ${expected}`, async () => {
      expect(await apiStatus(role, 'GET', path)).toBe(expected);
    });
  }
});
