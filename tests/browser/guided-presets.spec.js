import { test, expect } from '@playwright/test';

test('opens with a simple playable starter patch and wiring guidance', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.module-card[data-module-type="core.note-input"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.voice-sum"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.master-output"]')).toHaveCount(1);
  await expect(page.locator('#cable-layer [data-connection-id]')).toHaveCount(3);
  await expect(page.locator('#wiring-guide')).toContainText(/Note Input.*Oscillator.*Voice Sum.*Master/i);
});

test('exposes example patches and contextual tooltips', async ({ page }) => {
  await page.goto('./');
  const examples = page.locator('#example-patch');
  await expect(examples).toBeVisible();
  await expect(examples.locator('option')).toHaveCount(5);

  const pitchPort = page.locator('.module-card[data-module-type="core.oscillator"] [data-port-id="pitchIn"]');
  await expect(pitchPort).toHaveAttribute('title', /pitch/i);
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveAttribute('title', /oscillator/i);

  await examples.selectOption('filtered-subtractive');
  await expect(page.locator('.module-card[data-module-type="core.filter"]')).toHaveCount(1);
  await expect(page.locator('#wiring-guide')).toContainText(/filter/i);
});
