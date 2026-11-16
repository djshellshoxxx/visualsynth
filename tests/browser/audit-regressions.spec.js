import { test, expect } from '@playwright/test';

test('repeated module movement uses the latest position and undo separates gestures', async ({ page }) => {
  await page.goto('./');
  const card = page.locator('[data-module-id="osc"]').first();
  const x = Number(await card.getAttribute('data-x'));
  await card.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(Number(await card.getAttribute('data-x'))).toBe(x + 48);
  await page.evaluate(() => document.querySelector('.app-shell').visualSynthWorkspace.undo());
  expect(Number(await card.getAttribute('data-x'))).toBe(x + 24);
});

test('loaded patches with sparse generated IDs can add and duplicate modules', async ({ page }) => {
  await page.goto('./');
  const result = await page.evaluate(() => {
    const w = document.querySelector('.app-shell').visualSynthWorkspace;
    const template = structuredClone(w.patch.modules.osc);
    w.replacePatch({ modules: { 'module-3': { ...template, id: 'module-3' }, 'module-4': { ...template, id: 'module-4' } }, connections: [] });
    w.addModule('core.oscillator'); w.duplicateModule('module-3');
    return Object.keys(w.patch.modules);
  });
  expect(new Set(result).size).toBe(4);
});

test('blocked storage leaves the synth playable and reports save failure', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  await page.goto('./');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-app-state', 'ready');
  await page.locator('#patch-save').click();
  await expect(page.locator('#workspace-status')).toContainText('Could not save');
  await page.locator('#audio-start').click();
  await expect(page.locator('#audio-status')).toHaveText('running');
});

test('live worklet actually renders nonzero audio after a note', async ({ page }) => {
  await page.goto('./');
  await page.locator('#audio-start').click();
  await expect(page.locator('#audio-status')).toHaveText('running');
  await page.keyboard.down('a');
  await expect.poll(() => page.evaluate(() => document.querySelector('.app-shell').visualSynthEngine.diagnostics().telemetry.peak)).toBeGreaterThan(0);
  await page.keyboard.up('a');
  await expect.poll(() => page.evaluate(() => document.querySelector('.app-shell').visualSynthEngine.diagnostics().telemetry.activeVoices)).toBe(0);
});

test('moving the gain slider after mute updates the mute button label', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Mute master', exact: true }).click();
  const gain = page.getByRole('slider', { name: 'Master gain', exact: true });
  await gain.fill('0.5');
  await expect(page.getByRole('button', { name: 'Mute master', exact: true })).toBeVisible();
});

test('on-screen piano supports Enter and Space without stuck notes', async ({ page }) => {
  await page.goto('./');
  const key = page.locator('.piano-key').first();
  await key.focus();
  for (const button of ['Enter', 'Space']) {
    await page.keyboard.down(button);
    await expect(key).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up(button);
    await expect(key).toHaveAttribute('aria-pressed', 'false');
  }
});

test('processor faults expose a working audio retry button', async ({ page }) => {
  await page.goto('./'); await page.locator('#audio-start').click();
  await expect(page.locator('#audio-status')).toHaveText('running');
  await page.evaluate(() => document.querySelector('.app-shell').visualSynthEngine.node.dispatchEvent(new Event('processorerror')));
  await expect(page.locator('#audio-start')).toHaveText('Retry audio');
  await page.locator('#audio-start').click();
  await expect(page.locator('#audio-status')).toHaveText('running');
});
