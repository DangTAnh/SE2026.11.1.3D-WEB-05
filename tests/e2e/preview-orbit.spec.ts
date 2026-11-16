import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/preview-orbit.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.orbitTest))).toBe(true);
});

async function point(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
const snapshot = (page: Page) => page.evaluate(() => window.orbitTest.snapshot());
const hit = (page: Page, at: { x: number; y: number }) => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, at);
async function drag(page: Page, at: { x: number; y: number }) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 35, at.y - 20, { steps: 5 });
  await page.mouse.up();
}

test('center crosshair drag reaches canvas and rotates the real camera', async ({ page }) => {
  const center = await point(page, '.crosshair');
  expect(await hit(page, center)).toBe('preview-canvas');
  const before = await snapshot(page);
  await drag(page, center);
  const after = await snapshot(page);
  expect(after.position).not.toEqual(before.position);
  expect(after.quaternion).not.toEqual(before.quaternion);
  expect(after.distance).toBeCloseTo(before.distance, 8);
  expect(await page.evaluate(() => window.orbitTest.events)).toContain('pointerdown:mouse');
});

test('wheel over crosshair reaches OrbitControls and changes camera distance', async ({ page }) => {
  const center = await point(page, '.crosshair');
  const before = await snapshot(page);
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await snapshot(page)).distance).toBeGreaterThan(before.distance);
  expect(await page.evaluate(() => window.orbitTest.events)).toContain('wheel');
});

test('uncovered canvas still rotates the real camera', async ({ page }) => {
  const center = await point(page, '.crosshair');
  const at = { x: center.x - 45, y: center.y - 50 };
  expect(await hit(page, at)).toBe('preview-canvas');
  const before = await snapshot(page);
  await drag(page, at);
  expect((await snapshot(page)).position).not.toEqual(before.position);
});

test('upper decoration, lower text and playback gap pass gestures through', async ({ page }) => {
  const pause = await page.locator('#toggle-preview').boundingBox();
  const reset = await page.locator('#reset-preview').boundingBox();
  if (!pause || !reset) throw new Error('Missing playback buttons');
  const points = [await point(page, '.scene-upper .pill'), await point(page, '.render-tag'),
    await point(page, '#scene-mode'), { x: (pause.x + pause.width + reset.x) / 2, y: pause.y + pause.height / 2 }];
  for (const at of points) {
    expect(await hit(page, at)).toBe('preview-canvas');
    const before = await snapshot(page);
    await drag(page, at);
    expect((await snapshot(page)).position).not.toEqual(before.position);
  }
});

test('playback click and Tab Enter Space remain isolated from camera gestures', async ({ page }) => {
  const before = await snapshot(page);
  const pause = page.locator('#toggle-preview');
  const reset = page.locator('#reset-preview');
  for (const [id, button] of [['toggle-preview', pause], ['reset-preview', reset]] as const) {
    expect(await hit(page, await point(page, `#${id}`))).toBe(id);
    await button.hover();
    expect(await button.evaluate(el => el.matches(':hover'))).toBe(true);
    await button.click();
  }
  await page.evaluate(() => { window.uiTest.port.calls.length = 0; });
  // Fresh keyboard traversal begins from the document, not element.focus().
  await reset.evaluate(el => el.blur());
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Shift+Tab');
  for (let i = 0; i < 30 && !(await pause.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(pause).toBeFocused();
  expect(await pause.evaluate(el => el.matches(':focus-visible'))).toBe(true);
  expect(await pause.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(reset).toBeFocused();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.uiTest.port.calls.filter(c => c.type !== 'getStatus').map(c => c.type))).toEqual(['start', 'reset']);
  expect(await snapshot(page)).toEqual(before);
  expect(await page.evaluate(() => window.orbitTest.events)).toEqual([]);
});

test('disabled real OrbitControls preserves camera while canvas still receives input', async ({ page }) => {
  await page.evaluate(() => window.orbitTest.setEnabled(false));
  const before = await snapshot(page);
  const center = await point(page, '.crosshair');
  await drag(page, center);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => window.orbitTest.events.includes('wheel'))).toBe(true);
  expect(await snapshot(page)).toEqual(before);
});

test('mobile touch rotates at crosshair, preserves page scroll outside canvas and touch-action lifecycle', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-emulated CDP touch case; desktop mouse is covered separately.');
  const session = await page.context().newCDPSession(page);
  const center = await point(page, '.crosshair');
  const before = await snapshot(page);
  const scrollBefore = await page.evaluate(() => scrollY);
  expect(await page.locator('#preview-canvas').evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] });
  for (let i = 1; i <= 5; i++) await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: center.x + i * 7, y: center.y - i * 4, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await snapshot(page)).position).not.toEqual(before.position);
  expect(await page.evaluate(() => window.orbitTest.events)).toContain('pointerdown:touch');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  const heading = await point(page, '.scene-heading');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...heading, id: 2 }] });
  for (let i = 1; i <= 5; i++) await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: heading.x, y: heading.y - i * 20, id: 2 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
  await page.evaluate(() => window.orbitTest.dispose());
  expect(await page.locator('#preview-canvas').evaluate(el => el.style.touchAction)).toBe('');
  await session.detach();
});
