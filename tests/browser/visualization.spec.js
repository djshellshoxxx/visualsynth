import { test, expect } from '@playwright/test';

test('updates the master monitor from engine telemetry through the shared scheduler', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    shell.visualSynthEngine.telemetry = { peak: 0.72, activeVoices: 5 };
  });

  const meter = page.locator('#master-monitor [role="meter"]');
  await expect(meter).toHaveAttribute('aria-valuenow', '0.72');
  await expect(page.locator('#master-voices')).toHaveText('5');
  const fill = meter.locator('span');
  await expect(fill).toHaveCSS('height', /.+/);
});

test('exposes one shared visualization scheduler for the page', async ({ page }) => {
  await page.goto('./');
  const diagnostics = await page.evaluate(() => document.querySelector('.app-shell').visualSynthVisualizationScheduler.diagnostics());
  expect(diagnostics.registeredViews).toBeGreaterThanOrEqual(1);
});
