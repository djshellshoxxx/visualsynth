import { test, expect } from '@playwright/test';

test('opens diagnostics panel with copy and download controls', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /diagnostics/i }).click();

  const panel = page.locator('#diagnostics-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/audio/i);
  await expect(panel).toContainText(/modules/i);
  await expect(panel).toContainText(/connections/i);
  await expect(page.getByRole('button', { name: /copy diagnostics/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /download diagnostics/i })).toBeVisible();
});

test('diagnostics panel reflects the current patch and can be refreshed', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /diagnostics/i }).click();
  const modulesBefore = await page.locator('#diagnostics-modules').textContent();

  await page.getByRole('button', { name: 'Add LFO' }).click();
  await page.getByRole('button', { name: /refresh diagnostics/i }).click();

  await expect(page.locator('#diagnostics-modules')).not.toHaveText(modulesBefore ?? '');
  await expect(page.locator('#diagnostics-privacy')).toContainText(/no private/i);
});
