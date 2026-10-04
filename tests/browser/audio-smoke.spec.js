import { test, expect } from '@playwright/test';

test('starts the AudioWorklet engine from a user gesture', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('./');
  await expect(page.locator('#audio-status')).toHaveText('idle');
  await page.locator('#audio-start').click();
  await expect(page.locator('#audio-status')).toHaveText('running');
  await expect(page.locator('#audio-start')).toHaveText('Audio running');
  await expect(page.locator('#audio-start')).toBeDisabled();
  expect(errors).toEqual([]);
});
