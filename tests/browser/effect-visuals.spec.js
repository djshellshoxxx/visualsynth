import { test, expect } from '@playwright/test';

const cases = [
  ['distorted-bass', 'core.distortion', 'distortion'],
  ['slap-delay-lead', 'core.delay', 'delay'],
  ['dub-echo', 'core.echo', 'echo']
];

for (const [preset, moduleType, visualType] of cases) {
  test(`${moduleType} exposes an effect-specific predicted visualization`, async ({ page }) => {
    await page.goto('./');
    await page.locator('#example-patch').selectOption(preset);
    const module = page.locator(`.module-card[data-module-type="${moduleType}"]`);
    await expect(module).toHaveCount(1);
    await expect(module.locator(`canvas[data-module-visual="${visualType}"]`)).toHaveCount(1);
    await expect(module.locator('figcaption')).toContainText(/Predicted/i);
    await expect(module.locator('.parameter-bank')).toBeVisible();
  });
}
