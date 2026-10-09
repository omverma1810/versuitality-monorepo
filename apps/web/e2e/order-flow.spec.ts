import { expect, test, type Page } from '@playwright/test';

import { apiCall, login, uniqueMobile } from './helpers';

/** Click "Move to <status>" on the order page and wait for the badge/timeline to update. */
async function moveTo(page: Page, label: string) {
  await page.getByRole('button', { name: new RegExp(`Move to\\s*${label}`, 'i') }).click();
  await expect(page.getByText(new RegExp(`Moved to|${label}`, 'i')).first()).toBeVisible();
}


/** Mark every checklist row Pass once the checklist has loaded; returns how many rows there are. */
async function passEveryItem(page: Page): Promise<number> {
  await expect(page.getByRole('heading', { name: 'Quality checklist' })).toBeVisible();
  const passButtons = page.getByRole('button', { name: 'Pass', exact: true });
  await expect.poll(() => passButtons.count()).toBeGreaterThan(5);
  const n = await passButtons.count();
  for (let i = 0; i < n; i++) await passButtons.nth(i).click();
  return n;
}

async function makeClient(name: string) {
  return apiCall<{ id: string; client_id: string }>('staff', 'POST', '/clients/', { full_name: name, mobile: uniqueMobile() });
}

test.describe.serial('order lifecycle — client to delivery', () => {
  const clientName = `Flow Client ${Date.now().toString().slice(-5)}`;
  let orderUrl = '';
  let orderCode = '';

  test('staff takes the order through the wizard', async ({ page }) => {
    await makeClient(clientName);
    await login(page, 'staff');
    await page.goto('/orders/new');

    // Client
    await page.locator('#app-main').getByPlaceholder(/Search by name/i).fill(clientName);
    await page.getByRole('button', { name: new RegExp(clientName) }).first().click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Garments
    await page.getByPlaceholder(/Fabric \(e\.g\./).fill('Italian wool, navy pinstripe');
    await page.getByPlaceholder('Unit price').fill('12000');
    await page.getByRole('button', { name: /continue/i }).click();

    // Measurements (link step is optional) then review
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText('₹ 12,000').first()).toBeVisible();
    await page.getByRole('button', { name: /create order/i }).click();

    await page.waitForURL(/\/orders\/[0-9a-f-]{36}/);
    orderUrl = new URL(page.url()).pathname;
    orderCode = (await page.getByText(/VS-\d{8}-\d{4}/).first().textContent())!.match(/VS-\d{8}-\d{4}/)![0];
    await expect(page.getByText('Order received').first()).toBeVisible();
  });

  test('staff cannot drive production steps but master can', async ({ page }) => {
    await login(page, 'staff');
    await page.goto(orderUrl);
    // Staff may note requirements, but never cut or stitch.
    await expect(page.getByRole('button', { name: /Move to\s*Cutting started/i })).toHaveCount(0);
    await moveTo(page, 'Requirements noted');
  });

  test('master runs the production flow', async ({ page }) => {
    await login(page, 'master');
    await page.goto(orderUrl);
    await moveTo(page, 'Cutting started');
    await moveTo(page, 'Stitching in progress');
    await moveTo(page, 'Ready for trial');
    await moveTo(page, 'Ready for QC');
    // Master cannot pass QC himself.
    await expect(page.getByRole('button', { name: /Move to\s*Ready for delivery/i })).toHaveCount(0);
  });

  test('QA inspects and passes the garment', async ({ page }) => {
    await login(page, 'qa');
    await page.goto('/qa');
    await expect(page.getByText(orderCode).first()).toBeVisible();
    await page.goto(orderUrl.replace('/orders/', '/qa/'));
    await passEveryItem(page);
    await page.getByRole('button', { name: /Pass — ready for delivery/ }).click();
    await page.getByRole('button', { name: 'Confirm pass' }).click();
    await page.waitForURL(/inspected=pass/);
  });

  test('staff hands the order over to the client', async ({ page }) => {
    await login(page, 'staff');
    await page.goto(orderUrl);
    await moveTo(page, 'Delivered');
    await expect(page.getByText('This order is delivered')).toBeVisible();
  });

  test('accountant can read the order and download the receipt', async ({ page }) => {
    await login(page, 'accountant');
    await page.goto(orderUrl);
    await expect(page.getByText(orderCode).first()).toBeVisible();
    // The accountant has no production controls.
    await expect(page.getByRole('button', { name: /Move to/i })).toHaveCount(0);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/pdf/')),
      page.getByRole('button', { name: /PDF receipt/i }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });
});

test('QA rejection sends the order back to the master with a reason', async ({ page }) => {
  const client = await makeClient(`Reject Client ${Date.now().toString().slice(-5)}`);
  const order = await apiCall<{ id: string }>('staff', 'POST', '/orders/', {
    client: client.id,
    order_type: 'full',
    line_items: [{ garment_type: 'suit', quantity: 1, unit_price: '30000' }],
  });
  for (const target of ['requirements_noted', 'cutting_started', 'stitching_in_progress', 'ready_for_trial', 'ready_for_qc']) {
    await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target });
  }

  await login(page, 'qa');
  await page.goto(`/qa/${order.id}`);
  await passEveryItem(page);
  await page.getByRole('button', { name: 'Fail', exact: true }).first().click();
  await page.getByPlaceholder('Describe what needs to be redone').first().fill('Lapel roll uneven on the left');
  await page.getByRole('button', { name: /Reject — start rework/ }).click();
  await page.getByRole('button', { name: 'Confirm reject' }).click();
  await page.waitForURL(/inspected=fail/); // the page moves to the order once the rejection is recorded
  await expect(page.getByText(/gone back to the master for rework/i)).toBeVisible();

  const after = await apiCall<{ status: string }>('admin', 'GET', `/orders/${order.id}/`);
  expect(after.status).toBe('qc_rejected');
});
