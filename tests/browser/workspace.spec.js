import { test, expect } from '@playwright/test';

test('adds, duplicates, moves and removes modules', async ({ page }) => {
  await page.goto('./');
  const oscillators = page.locator('.module-card[data-module-type="core.oscillator"]');
  await expect(oscillators).toHaveCount(1);
  await page.getByRole('button', { name: 'Add Oscillator' }).click();
  await expect(oscillators).toHaveCount(2);
  const oscillator = oscillators.last();
  await expect(oscillator).toBeVisible();
  await expect(oscillator).toContainText('Oscillator');

  await oscillator.getByRole('button', { name: 'Duplicate Oscillator' }).click();
  await expect(oscillators).toHaveCount(3);

  const added = oscillators.nth(1);
  const beforeX = Number(await added.getAttribute('data-x'));
  await added.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await added.getAttribute('data-x'))).toBeGreaterThan(beforeX);

  await oscillators.last().getByRole('button', { name: 'Remove Oscillator' }).click();
  await expect(oscillators).toHaveCount(2);
});

test('connects compatible typed ports and rejects incompatible ports', async ({ page }) => {
  await page.goto('./');
  const cables = page.locator('#cable-layer [data-connection-id]');
  await expect(cables).toHaveCount(3);
  await page.getByRole('button', { name: 'Add Oscillator' }).click();
  await page.getByRole('button', { name: 'Add Multimode Filter' }).click();

  const oscillator = page.locator('.module-card[data-module-type="core.oscillator"]').last();
  const filter = page.locator('.module-card[data-module-type="core.filter"]').last();

  await oscillator.locator('[data-port-id="audioOut"]').click();
  await filter.locator('[data-port-id="audioIn"]').click();
  await expect(cables).toHaveCount(4);
  await expect(page.locator('#workspace-status')).toContainText('Connected');

  const newCable = cables.last();
  await newCable.focus();
  await page.keyboard.press('Delete');
  await expect(cables).toHaveCount(3);

  await oscillator.locator('[data-port-id="audioOut"]').click();
  await filter.locator('[data-port-id="cutoffMod"]').click();
  await expect(page.locator('#workspace-status')).toContainText(/mismatch|signal/i);
  await expect(cables).toHaveCount(3);
});

test('exposes touch-sized accessible connection targets', async ({ page }) => {
  await page.goto('./');
  const port = page.locator('.module-card[data-module-type="core.oscillator"] [data-port-id="audioOut"]').first();
  const box = await port.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(28);
  expect(box.height).toBeGreaterThanOrEqual(28);
  await expect(port).toHaveAttribute('aria-label', /audioOut/i);
});
