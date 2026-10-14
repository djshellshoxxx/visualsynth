import { test, expect } from '@playwright/test';

test('Save stores the canonical versioned patch document and Load restores it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => page.evaluate(async () => {
    const request = indexedDB.open('visualsynth', 1);
    const db = await new Promise((resolve, reject) => { request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    const tx=db.transaction('patches','readonly'); const get=tx.objectStore('patches').get('saved');
    return await new Promise((resolve,reject)=>{get.onsuccess=()=>resolve(get.result??null);get.onerror=()=>reject(get.error);});
  })).not.toBeNull();
  const saved = await page.evaluate(() => localStorage.getItem('visualsynth.patch.saved'));
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved)).toMatchObject({ format: 'visualsynth-patch', schemaVersion: 1 });

  await page.getByRole('button', { name: 'Add LFO' }).click();
  await expect(page.locator('.module-card[data-module-type="core.lfo"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('.module-card[data-module-type="core.lfo"]')).toHaveCount(0);
  await expect(page.locator('#workspace-status')).toContainText(/loaded saved patch/i);
});
