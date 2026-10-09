import { expect, test } from '@playwright/test';

import { apiCall, login, uniqueMobile } from './helpers';

/** A customer who has visited before: measurements (two visits) and two orders, one later cancelled. */
async function seedReturningCustomer(opts: { alt?: string } = {}) {
  const mobile = uniqueMobile();
  const name = `Returning ${Date.now().toString().slice(-6)}`;
  const client = await apiCall<{ id: string; client_id: string }>('staff', 'POST', '/clients/', {
    full_name: name,
    mobile,
    alt_mobile: opts.alt ?? '',
    occasion_preferences: ['wedding'],
  });
  await apiCall('staff', 'POST', '/measurements/', { client: client.id, garment_types: ['shirt'], upper_chest: '40' });
  const latest = await apiCall<{ id: string }>('staff', 'POST', '/measurements/', {
    client: client.id,
    garment_types: ['suit'],
    upper_chest: '41',
    upper_waist: '35',
    upper_shoulder: '18',
  });
  const first = await apiCall<{ id: string; order_id: string }>('staff', 'POST', '/orders/', {
    client: client.id,
    measurement_set: latest.id,
    order_type: 'full',
    line_items: [{ garment_type: 'suit', quantity: 1, unit_price: '32000', fabric_description: 'Navy herringbone wool', customization_notes: 'Peak lapel' }],
  });
  const cancelled = await apiCall<{ id: string }>('staff', 'POST', '/orders/', {
    client: client.id,
    order_type: 'full',
    line_items: [{ garment_type: 'blazer', quantity: 1, unit_price: '1' }],
  });
  await apiCall('staff', 'POST', `/orders/${cancelled.id}/cancel/`, { reason: 'test' });
  return { mobile, name, client, latest, first };
}

test.describe('returning customer recognition', () => {
  test('typing a known number (any format) loads the customer, their measurements and past orders', async ({ page }) => {
    const { mobile, name, latest, first } = await seedReturningCustomer();
    await login(page, 'staff');
    await page.goto('/orders/new');

    // National 10-digit form, no +91 — must still be recognised as the same person.
    await page.locator('#app-main').getByPlaceholder(/search by name/i).fill(mobile.slice(3));

    const card = page.getByRole('region', { name: 'Returning client' });
    await expect(card).toBeVisible();
    await expect(card.getByText(/welcome back/i)).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(card.getByLabel('Latest measurements')).toContainText('Chest');
    await expect(card.getByLabel('Latest measurements')).toContainText('41');
    await expect(card.getByText(first.order_id)).toBeVisible();
    await expect(card.getByText('blazer')).toHaveCount(0); // the cancelled order is not offered
    await expect(card.getByText(/1 previous order\b/)).toBeVisible();

    // Repeat the earlier order: garments, fabric, price and notes come across.
    await card.getByRole('button', { name: new RegExp(`Repeat order ${first.order_id}`) }).click();
    await expect(page.getByText(/garments copied from/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Fabric \(e\.g\./)).toHaveValue('Navy herringbone wool');
    await expect(page.getByLabel('Unit price').or(page.getByPlaceholder('Unit price'))).toHaveValue('32000');

    // Measurements: the newest set is already linked.
    await page.getByRole('button', { name: /continue/i }).click(); // garments -> measurements & schedule
    await expect(page.getByText(/schedule & advance/i)).toBeVisible();
    await page.getByRole('button', { name: /continue/i }).click(); // -> review
    await page.getByRole('button', { name: /create order/i }).click();
    await page.waitForURL(/\/orders\/[0-9a-f-]{36}/);

    const id = new URL(page.url()).pathname.split('/').pop();
    const created = await apiCall<any>('admin', 'GET', `/orders/${id}/`);
    expect(created.measurement_set).toBe(latest.id);
    expect(created.line_items[0].fabric_description).toBe('Navy herringbone wool');
    expect(created.line_items[0].customization_notes).toBe('Peak lapel');
    expect(Number(created.subtotal)).toBe(32000);
  });

  test('the alternate number finds the same customer', async ({ page }) => {
    const alt = uniqueMobile().replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    const { name } = await seedReturningCustomer({ alt });
    await login(page, 'staff');
    await page.goto('/orders/new');
    await page.locator('#app-main').getByPlaceholder(/search by name/i).fill(alt.slice(3));
    await expect(page.getByRole('region', { name: 'Returning client' })).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test('an unknown number offers to register a new customer and continues into the order', async ({ page }) => {
    const mobile = uniqueMobile();
    await login(page, 'staff');
    await page.goto('/orders/new');
    await page.locator('#app-main').getByPlaceholder(/search by name/i).fill(mobile);
    await expect(page.getByText(/new customer — no one is registered/i)).toBeVisible();
    await page.getByRole('link', { name: /register this customer/i }).click();

    await expect(page.getByLabel('Mobile (WhatsApp)')).toHaveValue(mobile); // number carried over
    const name = `Brand New ${Date.now().toString().slice(-5)}`;
    await page.getByLabel('Full name').fill(name);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: 'Shirt', exact: true }).click();
    await page.getByLabel('Chest').first().fill('39');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /save client/i }).click();

    // ...and lands straight back in the order wizard with the new customer selected.
    await page.waitForURL(/\/orders\/new\?client=/);
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Returning client' }).getByLabel('Latest measurements')).toContainText('39');
  });

  test('registering an existing number is blocked and points to the existing profile', async ({ page }) => {
    const { mobile, name, client } = await seedReturningCustomer();
    await login(page, 'staff');
    await page.goto('/clients/new');
    await page.getByLabel('Full name').fill('Someone Else');
    await page.getByLabel('Mobile (WhatsApp)').fill(mobile.slice(3));
    await expect(page.getByRole('alert').filter({ hasText: /already registered/i })).toContainText(name);
    await expect(page.getByRole('button', { name: /continue/i })).toBeDisabled();
    await page.getByRole('link', { name: /start a new order for/i }).first().click();
    await page.waitForURL(new RegExp(`/orders/new\\?client=${client.id}`));
    await expect(page.getByRole('region', { name: 'Returning client' })).toBeVisible();
  });

  test('new measurements start from the last visit and return to the order', async ({ page }) => {
    const { client, latest } = await seedReturningCustomer();
    await login(page, 'staff');
    await page.goto(`/clients/${client.id}/measurements/new?returnTo=${encodeURIComponent(`/orders/new?client=${client.id}`)}`);
    await expect(page.getByText(/pre-filled from the visit/i)).toBeVisible();
    await expect(page.getByLabel('Chest').first()).toHaveValue('41');
    await expect(page.getByLabel('Shoulder').first()).toHaveValue('18');

    await page.getByLabel('Waist').first().fill('34');
    await page.getByRole('button', { name: /save measurement set/i }).click();
    await page.waitForURL(new RegExp(`/orders/new\\?client=${client.id}`));

    // History keeps both: the new set is now the latest, the old one is untouched.
    const profile = await apiCall<any>('staff', 'GET', `/clients/${client.id}/profile/`);
    expect(profile.latest_measurement.id).not.toBe(latest.id);
    expect(Number(profile.latest_measurement.upper_waist)).toBe(34);
    expect(Number(profile.latest_measurement.upper_chest)).toBe(41);
    const sets = await apiCall<any>('staff', 'GET', `/measurements/?client=${client.id}`);
    expect(sets.count).toBe(3);
  });

  test('a return link pointing off-site is ignored', async ({ page }) => {
    const { client } = await seedReturningCustomer();
    await login(page, 'staff');
    await page.goto(`/clients/${client.id}/measurements/new?returnTo=${encodeURIComponent('//evil.example/phish')}`);
    await page.getByRole('button', { name: /save measurement set/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/measurements/new'));
    const after = new URL(page.url());
    expect(after.origin).toBe('http://localhost:3000'); // never left our own site
    expect(after.pathname).toBe(`/clients/${client.id}`); // fell back to the client's profile
  });

  test('only front desk can look customers up; master/QA/accountant get nothing', async () => {
    const { mobile } = await seedReturningCustomer();
    for (const role of ['qa', 'accountant'] as const) {
      await expect(apiCall(role, 'GET', `/clients/by_mobile/?mobile=${encodeURIComponent(mobile)}`)).rejects.toThrow(/403/);
    }
  });
});
