import { expect, test } from '@playwright/test';

test('WebGPU adapter initializes and renders on the application canvas when available', async ({ page }) => {
  const supported = await page.evaluate(async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return gpu ? (await gpu.requestAdapter()) !== null : false;
  });
  test.skip(!supported, 'This browser does not expose WebGPU.');
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#actual-backend')).toHaveText('WebGPU', { timeout: 15000 });
  const dimensions = await page.locator('#preview-canvas').evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height,
  }));
  expect(dimensions.width).toBeGreaterThan(1);
  expect(dimensions.height).toBeGreaterThan(1);
  const uniqueRenderedColors = await page.locator('#preview-canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    const image = new Image();
    image.src = canvas.toDataURL();
    await image.decode();
    const probe = document.createElement('canvas');
    probe.width = image.width;
    probe.height = image.height;
    const context = probe.getContext('2d');
    if (!context) throw new Error('2D canvas readback is unavailable.');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
    const colors = new Set<string>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
      colors.add(String(pixels[offset]) + ',' + String(pixels[offset + 1]) + ',' + String(pixels[offset + 2]));
      if (colors.size > 1) break;
    }
    return colors.size;
  });
  expect(uniqueRenderedColors).toBeGreaterThan(1);
  expect(pageErrors).toEqual([]);
});
