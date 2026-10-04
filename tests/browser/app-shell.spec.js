import { test, expect } from '@playwright/test';

test('loads VisualSynth shell without console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('./');

  await expect(page).toHaveTitle(/VisualSynth/i);
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('#module-library')).toBeVisible();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#keyboard')).toBeVisible();
  await expect(page.locator('#master-monitor')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
