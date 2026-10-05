import { test, expect } from '@playwright/test';

async function canvasSnapshot(locator) {
  return locator.evaluate(canvas => canvas.toDataURL());
}

test('oscillator waveform visual refreshes in place without moving cables', async ({ page }) => {
  await page.goto('./');
  const oscillator = page.locator('.module-card[data-module-type="core.oscillator"]');
  const canvas = oscillator.locator('canvas[data-module-visual="oscillator"]');
  const waveform = oscillator.locator('[data-parameter-id="waveform"] select');
  const cable = page.locator('#cable-layer [data-connection-id="c2"]');
  const beforeImage = await canvasSnapshot(canvas);
  const beforeCable = await cable.getAttribute('d');

  await waveform.selectOption('4');

  await expect.poll(() => canvasSnapshot(canvas)).not.toBe(beforeImage);
  await expect(cable).toHaveAttribute('d', beforeCable);
});

test('filter mode visual refreshes in place without rebuilding the module', async ({ page }) => {
  await page.goto('./');
  await page.locator('#example-patch').selectOption('highpass-lead');
  const filter = page.locator('.module-card[data-module-type="core.filter"]');
  await filter.evaluate(element => { element.dataset.identityProbe = 'same-filter'; });
  const canvas = filter.locator('canvas[data-module-visual="filter"]');
  const mode = filter.locator('[data-parameter-id="mode"] select');
  const beforeImage = await canvasSnapshot(canvas);

  await mode.selectOption('2');

  await expect.poll(() => canvasSnapshot(canvas)).not.toBe(beforeImage);
  await expect(filter).toHaveAttribute('data-identity-probe', 'same-filter');
});

test('distortion visual refreshes as drive changes', async ({ page }) => {
  await page.goto('./');
  await page.locator('#example-patch').selectOption('distorted-bass');
  const distortion = page.locator('.module-card[data-module-type="core.distortion"]');
  const canvas = distortion.locator('canvas[data-module-visual="distortion"]');
  const drive = distortion.locator('[data-parameter-id="drive"] input');
  const beforeImage = await canvasSnapshot(canvas);

  await drive.evaluate(input => {
    input.value = '12';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect.poll(() => canvasSnapshot(canvas)).not.toBe(beforeImage);
});
