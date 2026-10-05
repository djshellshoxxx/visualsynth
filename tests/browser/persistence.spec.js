import { test, expect } from '@playwright/test';

test('Save stores the canonical versioned patch document and Load restores it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Save patch' }).click();

  const saved = await page.evaluate(() => localStorage.getItem('visualsynth.patch.saved'));
  expect(saved).not.toBeNull();
  const document = JSON.parse(saved);
  expect(document).toMatchObject({ format: 'visualsynth-patch', schemaVersion: 1 });

  await page.getByRole('button', { name: 'Add LFO' }).click();
  await expect(page.locator('.module-card[data-module-type="core.lfo"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Load patch' }).click();
  await expect(page.locator('.module-card[data-module-type="core.lfo"]')).toHaveCount(0);
  await expect(page.locator('#workspace-status')).toContainText(/loaded saved patch/i);
});
