import { test, expect } from '@playwright/test';

test('adds, duplicates, moves and removes modules', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add Oscillator' }).click();
  const oscillator = page.locator('.module-card[data-module-type="core.oscillator"]').first();
  await expect(oscillator).toBeVisible();
  await expect(oscillator).toContainText('Oscillator');

  await oscillator.getByRole('button', { name: 'Duplicate Oscillator' }).click();
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(2);

  const first = page.locator('.module-card[data-module-type="core.oscillator"]').first();
  const beforeX = Number(await first.getAttribute('data-x'));
  await first.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await first.getAttribute('data-x'))).toBeGreaterThan(beforeX);

  await page.locator('.module-card[data-module-type="core.oscillator"]').last().getByRole('button', { name: 'Remove Oscillator' }).click();
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(1);
});

test('connects compatible typed ports and rejects incompatible ports', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add Oscillator' }).click();
  await page.getByRole('button', { name: 'Add Multimode Filter' }).click();

  const oscillator = page.locator('.module-card[data-module-type="core.oscillator"]').first();
  const filter = page.locator('.module-card[data-module-type="core.filter"]').first();

  await oscillator.locator('[data-port-id="audioOut"]').click();
  await filter.locator('[data-port-id="audioIn"]').click();
  await expect(page.locator('#cable-layer [data-connection-id]')).toHaveCount(1);
  await expect(page.locator('#workspace-status')).toContainText('Connected');

  await page.locator('#cable-layer [data-connection-id]').click({ position: { x: 2, y: 2 } });
  await expect(page.locator('#cable-layer [data-connection-id]')).toHaveCount(0);

  await oscillator.locator('[data-port-id="audioOut"]').click();
  await filter.locator('[data-port-id="cutoffMod"]').click();
  await expect(page.locator('#workspace-status')).toContainText(/incompatible|signal/i);
  await expect(page.locator('#cable-layer [data-connection-id]')).toHaveCount(0);
});

test('exposes touch-sized accessible connection targets', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add Oscillator' }).click();
  const port = page.locator('.module-card [data-port-id="audioOut"]');
  const box = await port.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(28);
  expect(box.height).toBeGreaterThanOrEqual(28);
  await expect(port).toHaveAttribute('aria-label', /audioOut/i);
});
