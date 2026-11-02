import { test as base, expect, type BrowserContext } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function routeVite(context: BrowserContext, server: ViteDevServer): Promise<void> {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') {
      await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return;
    }
    try {
      if (url.pathname === '/' || url.pathname.endsWith('.html')) {
        const file = path.resolve(process.cwd(), `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
        if (!file.startsWith(process.cwd() + path.sep)) { await route.abort(); return; }
        const html = await server.transformIndexHtml(url.pathname, await readFile(file, 'utf8'));
        await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      } else {
        const transformed = await server.transformRequest(url.pathname + url.search);
        if (!transformed) { await route.fulfill({ status: 404, body: 'not found' }); return; }
        await route.fulfill({ status: 200, contentType: 'text/javascript', body: transformed.code });
      }
    } catch (error) {
      console.error('VT121 transport:', url.pathname, error instanceof Error ? error.message : 'transform failed');
      await route.fulfill({ status: 500, body: 'transform failed' });
    }
  });
}

/** Optional in-process Vite transport; real modules/fixtures, no app state stubs. */
export const test = base.extend<{}, { transportServer: ViteDevServer | undefined }>({
  transportServer: [async ({}, use) => {
    if (!process.env.VT121_VITE_TRANSPORT) { await use(undefined); return; }
    const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try { await use(server); } finally { await server.close(); }
  }, { scope: 'worker' }],
  browser: [async ({ browser, transportServer }, use) => {
    if (!transportServer) { await use(browser); return; }
    const original = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await original(options);
      await routeVite(context, transportServer);
      return context;
    };
    try { await use(browser); } finally { browser.newContext = original; }
  }, { scope: 'worker' }],
});
export { expect };
