import { test, expect } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 }
]) {
  test(`${viewport.name} keeps core synth controls usable`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('./');

    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#module-library')).toBeVisible();
    await expect(page.locator('#workspace')).toBeVisible();
    await expect(page.locator('#keyboard')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start audio' })).toBeVisible();

    const workspaceBox = await page.locator('#workspace').boundingBox();
    expect(workspaceBox?.width ?? 0).toBeGreaterThanOrEqual(viewport.name === 'mobile' ? 320 : 500);
  });
}
