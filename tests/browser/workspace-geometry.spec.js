import { test, expect } from '@playwright/test';

async function cableError(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#workspace');
    const patch = document.querySelector('.app-shell').visualSynthWorkspace.patch;
    let error = 0;
    for (const c of patch.connections) {
      const path = root.querySelector(`[data-connection-id="${c.id}"]`);
      if (!path) return Infinity;
      const transform = path.getScreenCTM();
      for (const [endpoint, length] of [[c.from, 0], [c.to, path.getTotalLength()]]) {
        const port = root.querySelector(`[data-module-id="${endpoint.moduleId}"] [data-port-id="${endpoint.portId}"]`).getBoundingClientRect();
        const point = path.getPointAtLength(length).matrixTransform(transform);
        error = Math.max(error, Math.hypot(point.x - port.left - port.width / 2, point.y - port.top - port.height / 2));
      }
    }
    return error;
  });
}

test('cables track a real pointer drag before release and remain attached after scrolling', async ({ page }) => {
  await page.goto('./');
  const header = page.locator('[data-module-id="osc"] .module-card-header');
  await header.scrollIntoViewIfNeeded();
  const box = await header.boundingBox();
  await page.mouse.move(box.x + 35, box.y + 18); await page.mouse.down();
  await page.mouse.move(box.x + 125, box.y + 93, { steps: 5 });
  await expect.poll(() => cableError(page)).toBeLessThan(2);
  await page.mouse.up();
  await page.evaluate(() => { const w = document.querySelector('#workspace'); w.scrollLeft = 130; w.scrollTop = 150; });
  await page.evaluate(() => document.querySelector('.app-shell').visualSynthWorkspace.moveModule('osc', { x: 380, y: 260 }));
  await expect.poll(() => cableError(page)).toBeLessThan(2);
  await expect(page.locator('[data-connection-id]')).toHaveCount(3);
});

test('new modules appear in the visible workspace regardless of patch size or scroll position', async ({ page }) => {
  await page.goto('./');
  const result = await page.evaluate(() => {
    const w = document.querySelector('.app-shell').visualSynthWorkspace;
    for (let i = 0; i < 24; i++) w.addModule('core.oscillator');
    const root = document.querySelector('#workspace'); root.scrollLeft = 200; root.scrollTop = 350;
    const id = w.addModule('core.filter');
    const position = w.patch.modules[id].position;
    return { position, left: root.scrollLeft, top: root.scrollTop, width: root.clientWidth, height: root.clientHeight };
  });
  expect(result.position.y).toBeGreaterThanOrEqual(result.top);
  expect(result.position.y).toBeLessThan(result.top + Math.min(100, result.height));
  expect(result.position.x).toBeGreaterThanOrEqual(result.left);
  expect(result.position.x + 190).toBeLessThanOrEqual(result.left + result.width);
});

test('cables never intercept a module header when their curve crosses it', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-module-id="osc"] [data-port-id="audioOut"]').scrollIntoViewIfNeeded();
  await expect.poll(() => cableError(page)).toBeLessThan(2);
  const hit = await page.evaluate(() => {
    const path = document.querySelector('[data-connection-id="c2"]');
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
    const w = document.querySelector('.app-shell').visualSynthWorkspace;
    const origin = w.stage.getBoundingClientRect();
    w.moveModule('note', { x: point.x - origin.left - 70, y: point.y - origin.top - 18 });
    const element = document.elementFromPoint(point.x, point.y);
    return !!element?.closest('.module-card-header');
  });
  expect(hit).toBe(true);
});

test('cancelled drags restore the module and cables without changing patch history', async ({ page }) => {
  await page.goto('./');
  const header = page.locator('[data-module-id="osc"] .module-card-header');
  await header.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => { const w = document.querySelector('.app-shell').visualSynthWorkspace; return { position: w.patch.modules.osc.position, history: w.history.past.length }; });
  const box = await header.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 18); await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60);
  await header.dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await expect.poll(() => cableError(page)).toBeLessThan(2);
  const after = await page.evaluate(() => { const w = document.querySelector('.app-shell').visualSynthWorkspace; const card = w.stage.querySelector('[data-module-id="osc"]'); return { position: w.patch.modules.osc.position, history: w.history.past.length, x: card.offsetLeft, y: card.offsetTop }; });
  expect(after.position).toEqual(before.position);
  expect(after.history).toBe(before.history);
  expect(after.x).toBe(before.position.x); expect(after.y).toBe(before.position.y);
});

test('workspace and cable surfaces expand to include distant modules', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.querySelector('.app-shell').visualSynthWorkspace.moveModule('osc', { x: 1600, y: 1100 }));
  await expect.poll(() => page.locator('#cable-layer').evaluate(el => parseFloat(el.style.width))).toBeGreaterThan(1790);
  await expect.poll(() => page.locator('#cable-layer').evaluate(el => parseFloat(el.style.height))).toBeGreaterThan(1250);
  await expect.poll(() => cableError(page)).toBeLessThan(2);
});

test('tooltip styling never changes a module from canvas coordinates to document flow', async ({ page }) => {
  await page.goto('./');
  const cards = await page.locator('.module-card').evaluateAll(elements => elements.map(card => ({
    position: getComputedStyle(card).position,
    x: card.offsetLeft, y: card.offsetTop, expectedX: Number(card.dataset.x), expectedY: Number(card.dataset.y)
  })));
  for (const card of cards) {
    expect(card.position).toBe('absolute');
    expect(card.x).toBe(card.expectedX); expect(card.y).toBe(card.expectedY);
  }
});

test('scrolling while dragging preserves the pointer offset and commits only once', async ({ page }) => {
  await page.goto('./');
  const header = page.locator('[data-module-id="osc"] .module-card-header');
  await header.scrollIntoViewIfNeeded();
  const box = await header.boundingBox();
  const before = await page.evaluate(() => {
    const w = document.querySelector('.app-shell').visualSynthWorkspace;
    return { x: w.patch.modules.osc.position.x, scroll: w.root.scrollLeft, history: w.history.past.length };
  });
  await page.mouse.move(box.x + 30, box.y + 18); await page.mouse.down();
  const scroll = await page.evaluate(() => { const w = document.querySelector('#workspace'); w.scrollLeft += 60; return w.scrollLeft; });
  await page.mouse.move(box.x + 50, box.y + 18);
  await expect.poll(() => cableError(page)).toBeLessThan(2);
  await page.mouse.up();
  const after = await page.evaluate(() => { const w = document.querySelector('.app-shell').visualSynthWorkspace; return { x: w.patch.modules.osc.position.x, history: w.history.past.length }; });
  expect(after.x).toBe(before.x + 20 + scroll - before.scroll);
  expect(after.history).toBe(before.history + 1);
});

test('reused cable IDs update labels and accessible endpoints when a preset changes', async ({ page }) => {
  await page.goto('./');
  await page.locator('#example-patch').selectOption('warm-analog');
  await expect(page.locator('[data-connection-id="c2"]')).toHaveAttribute('aria-label', 'Disconnect note pitchOut from osc2 pitchIn');
  await page.locator('#example-patch').selectOption('filtered-square');
  await expect(page.locator('[data-connection-group-id="c3"]')).toContainText('Multimode Filter');
  await page.locator('#example-patch').selectOption('crunch-lead');
  await expect(page.locator('[data-connection-group-id="c3"]')).toContainText('Distortion');
});
