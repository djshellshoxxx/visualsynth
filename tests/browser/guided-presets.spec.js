import { test, expect } from '@playwright/test';

const PRESET_IDS = [
  'basic-saw', 'warm-analog', 'sub-bass', 'reese-bass', 'pluck', 'soft-pad', 'acid-bass', 'pulse-lead', 'bright-lead',
  'deep-house-bass', 'detuned-saw', 'chip-lead', 'organ', 'drone', 'filtered-square', 'highpass-lead', 'bandpass-radio',
  'distorted-bass', 'crunch-lead', 'slap-delay-lead', 'dub-echo', 'space-pad', 'industrial-pulse', 'init-patch'
];

test('opens with a simple playable starter patch and wiring guidance', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.module-card[data-module-type="core.note-input"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.oscillator"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.voice-sum"]')).toHaveCount(1);
  await expect(page.locator('.module-card[data-module-type="core.master-output"]')).toHaveCount(1);
  await expect(page.locator('#cable-layer [data-connection-id]')).toHaveCount(3);
  await expect(page.locator('#wiring-guide')).toContainText(/saw oscillator/i);
});

test('exposes 24 one-click quick setup configurations', async ({ page }) => {
  await page.goto('./');
  const presets = page.locator('#example-patch');
  await expect(page.locator('.example-picker')).toContainText('Quick Setup');
  await expect(presets).toBeVisible();
  await expect(presets.locator('option')).toHaveCount(PRESET_IDS.length);
  for (const id of PRESET_IDS) {
    await presets.selectOption(id);
    await expect(presets).toHaveValue(id);
    await expect(page.locator('.module-card[data-module-type="core.note-input"]')).toHaveCount(1);
    await expect(page.locator('.module-card[data-module-type="core.master-output"]')).toHaveCount(1);
    await expect(page.locator('#workspace-status')).toContainText(/Loaded (preset|example):/i);
  }
});

test('effect presets expose real distortion delay and echo modules', async ({ page }) => {
  await page.goto('./');
  const presets = page.locator('#example-patch');
  await presets.selectOption('distorted-bass');
  await expect(page.locator('.module-card[data-module-type="core.distortion"]')).toHaveCount(1);
  await presets.selectOption('slap-delay-lead');
  await expect(page.locator('.module-card[data-module-type="core.delay"]')).toHaveCount(1);
  await presets.selectOption('dub-echo');
  await expect(page.locator('.module-card[data-module-type="core.echo"]')).toHaveCount(1);
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

test('parameter edits do not rebuild modules or make cables jump', async ({ page }) => {
  await page.goto('./');
  const oscillator = page.locator('.module-card[data-module-type="core.oscillator"]');
  await oscillator.evaluate(element => { element.dataset.identityProbe = 'same-node'; });
  const cableBefore = await page.locator('#cable-layer [data-connection-id="c2"]').getAttribute('d');
  const amplitude = oscillator.locator('[data-parameter-id="amplitude"] input');
  await amplitude.evaluate(input => {
    input.value = '0.42'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(oscillator).toHaveAttribute('data-identity-probe', 'same-node');
  await expect(page.locator('#cable-layer [data-connection-id="c2"]')).toHaveAttribute('d', cableBefore);
});

test('each cable shows source and destination signal information parallel to the arm', async ({ page }) => {
  await page.goto('./');
  const cable = page.locator('#cable-layer [data-connection-id="c2"]').locator('..');
  await expect(cable.locator('text.cable-label')).toHaveCount(2);
  await expect(cable.locator('text.cable-label-source')).toContainText(/OUT.*audioOut.*AUDIO/i);
  await expect(cable.locator('text.cable-label-destination')).toContainText(/IN.*audioIn.*AUDIO/i);
  await expect(cable.locator('textPath')).toHaveCount(2);
});
