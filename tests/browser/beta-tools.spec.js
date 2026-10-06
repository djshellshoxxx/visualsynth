import { test, expect } from '@playwright/test';

test('beta tools expose complexity, learning, MIDI, mutation, signal and render controls', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('region', { name: 'Beta tools' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Complexity mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learning mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect MIDI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Safe mutate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trace signal flow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capture compare A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export patch JSON' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Render WAV' })).toBeVisible();
});

test('complexity mode changes visibility without mutating patch semantics', async ({ page }) => {
  await page.goto('./');
  const before = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  await page.getByRole('combobox', { name: 'Complexity mode' }).selectOption('beginner');
  await expect(page.getByRole('button', { name: 'Add Wavetable Oscillator' })).toBeHidden();
  const after = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  expect(after).toBe(before);
  await page.getByRole('combobox', { name: 'Complexity mode' }).selectOption('advanced');
  await expect(page.getByRole('button', { name: 'Add Wavetable Oscillator' })).toBeVisible();
});

test('safe mutation is undoable', async ({ page }) => {
  await page.goto('./');
  const original = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  await page.getByRole('button', { name: 'Safe mutate' }).click();
  const mutated = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  expect(mutated).not.toBe(original);
  await page.getByRole('button', { name: 'Undo patch edit' }).click();
  const restored = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  expect(restored).toBe(original);
});

test('learning mode offers the complete lesson set and can be disabled without changing patch', async ({ page }) => {
  await page.goto('./');
  const before = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  await page.getByRole('button', { name: 'Learning mode' }).click();
  await expect(page.getByRole('combobox', { name: 'Learning lesson' })).toBeVisible();
  expect(await page.getByRole('combobox', { name: 'Learning lesson' }).locator('option').count()).toBeGreaterThanOrEqual(20);
  await page.getByRole('button', { name: 'Learning mode' }).click();
  const after = await page.evaluate(() => JSON.stringify(document.querySelector('.app-shell').visualSynthWorkspace.patch));
  expect(after).toBe(before);
});

test('signal flow highlights a source-to-master route', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Trace signal flow' }).click();
  expect(await page.locator('.module-card[data-signal-path="true"]').count()).toBeGreaterThan(1);
});
