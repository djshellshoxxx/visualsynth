import { test, expect } from '@playwright/test';

test('on-screen keyboard emits press state with mouse/pointer interaction', async ({ page }) => {
  await page.goto('./');
  const key = page.locator('#keyboard [data-note="60"]');
  await expect(key).toBeVisible();
  await key.dispatchEvent('pointerdown', { pointerId: 1, button: 0 });
  await expect(key).toHaveAttribute('aria-pressed', 'true');
  await key.dispatchEvent('pointerup', { pointerId: 1, button: 0 });
  await expect(key).toHaveAttribute('aria-pressed', 'false');
});

test('octave controls transpose the on-screen keyboard', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#keyboard [data-note="60"]')).toBeVisible();
  await page.getByRole('button', { name: 'Keyboard octave up' }).click();
  await expect(page.locator('#keyboard [data-note="72"]')).toBeVisible();
  await page.getByRole('button', { name: 'Keyboard octave down' }).click();
  await expect(page.locator('#keyboard [data-note="60"]')).toBeVisible();
});

test('panic and master controls are available after audio startup', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Panic all notes off' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Master gain' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mute master' })).toBeVisible();

  await page.getByRole('slider', { name: 'Master gain' }).fill('0.5');
  await expect(page.locator('#master-gain-value')).toContainText('0.50');
  await page.getByRole('button', { name: 'Mute master' }).click();
  await expect(page.getByRole('button', { name: 'Unmute master' })).toBeVisible();
});
