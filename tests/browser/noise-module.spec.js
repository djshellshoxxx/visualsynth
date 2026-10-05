import { test, expect } from '@playwright/test';

test('Noise Generator is available from the module library', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add Noise Generator' }).click();

  const noise = page.locator('.module-card[data-module-type="standard.noise"]');
  await expect(noise).toHaveCount(1);
  await expect(noise).toContainText('Noise Generator');
  await expect(noise.locator('[data-parameter-id="type"]')).toBeVisible();
  await expect(noise.locator('[data-parameter-id="level"]')).toBeVisible();
  await expect(noise.locator('[data-parameter-id="seed"]')).toBeVisible();
  await expect(noise.locator('[data-port-id="audioOut"]')).toHaveAttribute('title', /audio/i);
});
