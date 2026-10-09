import { expect, test } from '@playwright/test';

import { apiCall, login, uniqueMobile } from './helpers';

test.describe('walk-in client intake', () => {
  test('staff registers a walk-in client with measurements', async ({ page }) => {
    const mobile = uniqueMobile();
    const name = `E2E Walk-in ${Date.now()}`;

    await login(page, 'staff');
    await page.goto('/clients/new');
    await expect(page.getByRole('heading', { name: 'Register a client' })).toBeVisible();

    // Step 1 — contact details
    await page.getByLabel('Full name').fill(name);
    await page.getByLabel('Mobile (WhatsApp)').fill(mobile);
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2 — style preferences (optional)
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3 — measurements
    await page.getByRole('button', { name: 'Shirt', exact: true }).click();
    await page.getByLabel('Chest').first().fill('40');
    await page.getByLabel('Shoulder').first().fill('18');
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 4 — review & save
    await expect(page.getByText(name)).toBeVisible();
    await page.getByRole('button', { name: /save client/i }).click();

    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/);
    await expect(page.getByText(name).first()).toBeVisible();

    // The record exists server-side with a normalised mobile and a client id.
    const found = await apiCall<{ results: any[] }>('staff', 'GET', `/clients/?search=${encodeURIComponent(name)}`);
    expect(found.results).toHaveLength(1);
    expect(found.results[0].mobile).toBe(mobile);
    expect(found.results[0].client_id).toMatch(/^VS-CL-/);
  });

  test('registering the same mobile again warns about a returning client', async ({ page }) => {
    const mobile = uniqueMobile();
    await apiCall('staff', 'POST', '/clients/', { full_name: 'Existing Customer', mobile });

    await login(page, 'staff');
    await page.goto('/clients/new');
    await page.getByLabel('Full name').fill('Existing Customer');
    await page.getByLabel('Mobile (WhatsApp)').fill(mobile);
    await expect(page.getByText('Returning client')).toBeVisible();
  });
});
