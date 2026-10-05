import { test, expect } from '@playwright/test';

const PRESET_IDS = [
  'basic-saw',
  'warm-analog',
  'sub-bass',
  'reese-bass',
  'pluck',
  'soft-pad',
  'acid-bass',
  'pulse-lead',
  'bright-lead',
  'init-patch'
];

test('opens with a simple playable starter patch and wiring guidance', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.module-card[data-module-type="core.note-input"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.voice-sum"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.master-output"]')).toHaveCount(1);
  await expect(page.locator('#cable-layer [data-connection-id]')).toHaveCount(3);
  await expect(page.locator('#wiring-guide')).toContainText(/Note Input.*Oscillator.*Voice Sum.*Master/i);
});

test('exposes one-click quick setup configurations and contextual tooltips', async ({ page }) => {
  await page.goto('./');
  const presets = page.locator('#example-patch');
  await expect(page.locator('.example-picker')).toContainText('Quick Setup');
  await expect(presets).toBeVisible();
  await expect(presets.locator('option')).toHaveCount(PRESET_IDS.length);
  await expect(presets.locator('option')).toHaveText([
    'Basic Saw',
    'Warm Analog',
    'Sub Bass',
    'Reese Bass',
    'Pluck',
    'Soft Pad',
    'Acid Bass',
    'Pulse Lead',
    'Bright Lead',
    'Init / Minimal'
  ]);

  const pitchPort = page.locator('.module-card[data-module-type="core.oscillator"] [data-port-id="pitchIn"]');
  await expect(pitchPort).toHaveAttribute('title', /pitch/i);
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveAttribute('title', /oscillator/i);

  for (const id of PRESET_IDS) {
    await presets.selectOption(id);
    await expect(presets).toHaveValue(id);
    await expect(page.locator('.module-card[data-module-type="core.note-input"]')).toHaveCount(1);
    await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(id === 'warm-analog' || id === 'reese-bass' || id === 'soft-pad' || id === 'bright-lead' ? 2 : 1);
    await expect(page.locator('.module-card[data-module-type="core.master-output"]')).toHaveCount(1);
    await expect(page.locator('#workspace-status')).toContainText(/Loaded (preset|example):/i);
  }
});

test('New loads the clean init patch instead of silently restoring the demo preset', async ({ page }) => {
  await page.goto('./');
  const presets = page.locator('#example-patch');
  await presets.selectOption('reese-bass');
  await page.locator('#patch-new').click();

  await expect(presets).toHaveValue('init-patch');
  await expect(page.locator('#wiring-guide strong')).toHaveText('Init / Minimal');
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(1);
  await expect(page.locator('#workspace-status')).toContainText(/New patch/i);
});
