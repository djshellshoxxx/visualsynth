import { test, expect } from '@playwright/test';

test('loads application assets correctly from the GitHub Pages subpath', async ({ page }) => {
  const failures = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/visualsynth/') && response.status() >= 400) failures.push(`${response.status()} ${url}`);
  });

  await page.goto('./');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-app-state', 'ready');

  const urls = await page.evaluate(() => ({
    script: document.querySelector('script[type="module"]')?.src ?? '',
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.href)
  }));

  expect(urls.script).toContain('/visualsynth/src/app.js');
  expect(urls.styles.length).toBeGreaterThanOrEqual(2);
  for (const url of urls.styles) expect(url).toContain('/visualsynth/');
  expect(failures).toEqual([]);
});
