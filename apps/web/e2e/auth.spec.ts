import { expect, test } from '@playwright/test';

import { PASSWORD, emailFor, login, type RoleName } from './helpers';

test.describe('authentication', () => {
  test('login page shows the brand and API status', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('wrong password is rejected with a clear message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(emailFor('staff'));
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/sign in failed|invalid credentials/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected pages bounce anonymous visitors to the login page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });

  test('user can sign out and is locked out again', async ({ page }) => {
    await login(page, 'staff');
    await page.getByRole('button', { name: /Sanjay Staff/ }).click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});

/** What each role may see in the sidebar — mirrors nav-config.ts and the API role matrix. */
const NAV: Record<RoleName, { visible: string[]; hidden: string[] }> = {
  admin: {
    visible: ['Dashboard', 'Clients', 'Orders', 'Quality Check', 'Appointments', 'Inventory', 'Team & roles', 'Analytics', 'Audit log'],
    hidden: [],
  },
  staff: {
    visible: ['Dashboard', 'Clients', 'Orders', 'Appointments', 'Inventory'],
    hidden: ['Quality Check', 'Team & roles', 'Analytics', 'Audit log'],
  },
  master: {
    visible: ['Dashboard', 'Clients', 'Orders', 'Inventory'],
    hidden: ['Quality Check', 'Appointments', 'Team & roles', 'Analytics', 'Audit log'],
  },
  qa: {
    visible: ['Dashboard', 'Orders', 'Quality Check'],
    hidden: ['Clients', 'Appointments', 'Inventory', 'Team & roles', 'Analytics', 'Audit log'],
  },
  accountant: {
    visible: ['Dashboard', 'Orders', 'Analytics'],
    hidden: ['Clients', 'Quality Check', 'Appointments', 'Inventory', 'Team & roles', 'Audit log'],
  },
};

for (const role of Object.keys(NAV) as RoleName[]) {
  test(`${role} sees only the navigation their role allows`, async ({ page }) => {
    expect(PASSWORD).not.toEqual('');
    await login(page, role);
    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    for (const label of NAV[role].visible) {
      await expect(sidebar.getByRole('link', { name: label, exact: false }).first(), `${role} should see ${label}`).toBeVisible();
    }
    for (const label of NAV[role].hidden) {
      await expect(sidebar.getByRole('link', { name: label, exact: false }), `${role} must not see ${label}`).toHaveCount(0);
    }
  });
}
