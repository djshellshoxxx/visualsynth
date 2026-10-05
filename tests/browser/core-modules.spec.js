import { test, expect } from '@playwright/test';

test('renders oscillator parameters with a predicted waveform view', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add Oscillator' }).click();
  const module = page.locator('.module-card[data-module-type="core.oscillator"]');
  await expect(module.locator('[data-parameter-id="waveform"]')).toBeVisible();
  await expect(module.locator('[data-parameter-id="amplitude"]')).toBeVisible();
  await expect(module.locator('canvas[data-module-visual="oscillator"]')).toBeVisible();
  await expect(module.locator('figcaption[data-visual-source="predicted"]')).toContainText(/predicted/i);

  await module.locator('[data-parameter-id="amplitude"] input').fill('0.5');
  await module.locator('[data-parameter-id="amplitude"] input').dispatchEvent('change');
  const value = await page.evaluate(() => {
    const workspace = document.querySelector('.app-shell').visualSynthWorkspace;
    const id = Object.keys(workspace.patch.modules)[0];
    return workspace.patch.modules[id].parameters.amplitude;
  });
  expect(value).toBe(0.5);
});

test('renders parameter controls for filter ADSR LFO VCA and master', async ({ page }) => {
  await page.goto('./');
  for (const name of ['Multimode Filter', 'ADSR', 'LFO', 'VCA', 'Master Output']) {
    await page.getByRole('button', { name: `Add ${name}` }).click();
  }
  await expect(page.locator('.module-card[data-module-type="core.filter"] [data-parameter-id="cutoff"]')).toBeVisible();
  await expect(page.locator('.module-card[data-module-type="core.adsr"] [data-parameter-id="attack"]')).toBeVisible();
  await expect(page.locator('.module-card[data-module-type="core.lfo"] [data-parameter-id="rate"]')).toBeVisible();
  await expect(page.locator('.module-card[data-module-type="core.vca"] [data-parameter-id="gain"]')).toBeVisible();
  await expect(page.locator('.module-card[data-module-type="core.master-output"] [data-parameter-id="gain"]')).toBeVisible();
});

test('shows filter envelope and LFO visuals with explicit provenance labels', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Add Multimode Filter' }).click();
  await page.getByRole('button', { name: 'Add ADSR' }).click();
  await page.getByRole('button', { name: 'Add LFO' }).click();
  await expect(page.locator('[data-module-visual="filter"]')).toHaveAttribute('data-visual-source', 'predicted');
  await expect(page.locator('[data-module-visual="adsr"]')).toHaveAttribute('data-visual-source', 'predicted');
  await expect(page.locator('[data-module-visual="lfo"]')).toHaveAttribute('data-visual-source', 'predicted');
});
