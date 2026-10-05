import { test, expect } from '@playwright/test';

test('exposes keyboard-reachable controls and text signal identities', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Start audio' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Quick setup preset' })).toBeVisible();

  const oscillator = page.locator('.module-card[data-module-type="core.oscillator"]').first();
  await expect(oscillator).toHaveAttribute('tabindex', '0');
  const audioOut = oscillator.locator('[data-port-id="audioOut"]');
  await expect(audioOut).toHaveAttribute('aria-label', /audio/i);
  await expect(audioOut).toContainText(/audioOut/i);

  const amplitude = oscillator.locator('[data-parameter-id="amplitude"] input');
  await expect(amplitude).toHaveAttribute('aria-label', /amplitude/i);
});

test('reduced-motion preference disables decorative glow and motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const statusDot = page.locator('.status-dot');
  await expect(statusDot).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.module-card').first()).toHaveCSS('transition-duration', '0s');
});

test('diagnostics disclosure exposes expanded state without relying on color', async ({ page }) => {
  await page.goto('./');
  const button = page.getByRole('button', { name: /diagnostics/i });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#diagnostics-panel')).toBeVisible();
});
