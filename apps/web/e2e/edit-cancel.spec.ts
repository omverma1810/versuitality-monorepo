import { expect, test } from '@playwright/test';

import { apiCall, login, uniqueMobile } from './helpers';

async function newOrder(unitPrice = '10000') {
  const client = await apiCall<{ id: string }>('staff', 'POST', '/clients/', {
    full_name: `Edit Client ${Date.now().toString().slice(-5)}`,
    mobile: uniqueMobile(),
  });
  return apiCall<{ id: string; order_id: string }>('staff', 'POST', '/orders/', {
    client: client.id,
    order_type: 'full',
    line_items: [{ garment_type: 'shirt', quantity: 1, unit_price: unitPrice }],
  });
}

test.describe('editing an order', () => {
  test('front desk changes garments, dates, payment and notes before cutting starts', async ({ page }) => {
    const order = await newOrder('10000');
    await login(page, 'staff');
    await page.goto(`/orders/${order.id}`);
    await page.getByRole('link', { name: /edit order/i }).click();
    await expect(page.getByRole('heading', { name: 'Edit order' })).toBeVisible();

    await page.getByLabel('Unit price').first().fill('12000');
    await page.getByLabel('Delivery date').fill('2030-03-15');
    await page.getByLabel('Paid so far (advance)').fill('5000');
    await page.locator('#order-notes').fill('Client asked for working buttonholes');
    await page.getByRole('button', { name: /save changes/i }).click();

    await page.waitForURL(new RegExp(`/orders/${order.id}`));
    await expect(page.getByText('Changes saved.')).toBeVisible();
    await expect(page.getByText('₹ 12,000').first()).toBeVisible();
    await expect(page.getByText('₹ 7,000').first()).toBeVisible(); // balance

    const saved = await apiCall<any>('admin', 'GET', `/orders/${order.id}/`);
    expect(saved.delivery_date).toBe('2030-03-15');
    expect(saved.notes).toBe('Client asked for working buttonholes');
  });

  test('garments are locked once the master has started cutting', async ({ page }) => {
    const order = await newOrder();
    await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'requirements_noted' });
    await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'cutting_started' });
    await login(page, 'staff');
    await page.goto(`/orders/${order.id}/edit`);
    await expect(page.getByText(/garments are locked/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add line/i })).toHaveCount(0);
    await page.getByLabel('Paid so far (advance)').fill('2000');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Changes saved.')).toBeVisible();
  });

  test('an advance larger than the total is refused with a clear message', async ({ page }) => {
    const order = await newOrder('1000');
    await login(page, 'staff');
    await page.goto(`/orders/${order.id}/edit`);
    await page.getByLabel('Paid so far (advance)').fill('5000');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(/advance/i);
  });

  for (const role of ['master', 'qa', 'accountant'] as const) {
    test(`${role} is never offered Edit or Cancel`, async ({ page }) => {
      const order = await newOrder();
      await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'requirements_noted' });
      await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'cutting_started' });
      await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'stitching_in_progress' });
      await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'ready_for_trial' });
      await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: 'ready_for_qc' }); // visible to QA too
      await login(page, role);
      await page.goto(`/orders/${order.id}`);
      await expect(page.getByText(order.order_id).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /edit order/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);
    });
  }
});

test.describe('cancelling an order', () => {
  test('front desk cancels with a reason; the order is closed for everyone', async ({ page }) => {
    const order = await newOrder();
    await login(page, 'staff');
    await page.goto(`/orders/${order.id}`);

    await page.getByRole('button', { name: /cancel order/i }).click();
    const dialog = page.getByRole('dialog', { name: /cancel order/i });
    const confirm = dialog.getByRole('button', { name: /^cancel order$/i });
    await expect(confirm).toBeDisabled(); // a reason is mandatory
    await dialog.getByPlaceholder(/why is this order/i).fill('Client travelled abroad');
    await confirm.click();

    await expect(page.getByText('This order was cancelled. No further steps are possible.')).toBeVisible();
    await expect(page.locator('p').filter({ hasText: /client travelled abroad/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /edit order/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);

    // The edit page refuses and the API reports it closed.
    await page.goto(`/orders/${order.id}/edit`);
    await expect(page.getByText(/this order was cancelled/i)).toBeVisible();
    const detail = await apiCall<any>('admin', 'GET', `/orders/${order.id}/`);
    expect(detail.status).toBe('cancelled');
    expect(detail.next_statuses).toEqual([]);
  });

  test('a delivered order cannot be cancelled', async ({ page }) => {
    const order = await newOrder();
    for (const t of ['requirements_noted', 'cutting_started', 'stitching_in_progress', 'ready_for_trial', 'ready_for_qc']) {
      await apiCall('master', 'POST', `/orders/${order.id}/transition/`, { target: t });
    }
    await apiCall('admin', 'POST', `/orders/${order.id}/transition/`, { target: 'delivered' });
    await login(page, 'staff');
    await page.goto(`/orders/${order.id}`);
    await expect(page.getByText(order.order_id).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);
  });
});
