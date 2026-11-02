import { test as base, expect, type BrowserContext } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function routeVite(context: BrowserContext, server: ViteDevServer): Promise<void> {
  // Vite's dev client opens HMR even in middleware mode. Terminate only that
  // local development-tool connection in transport, rather than filtering app errors.
  await context.routeWebSocket(/^ws:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, socket => {
    socket.onMessage(() => {});
  });
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
    const sourceRoot = process.env.VT121_SOURCE_BASELINE;
    const root = process.cwd();
    const server = await createServer({ configFile: false, cacheDir: sourceRoot ? "node_modules/.vite-vt121-baseline" : "node_modules/.vite-vt121",
      plugins: sourceRoot ? [{ name: 'vt121-immutable-baseline-source', enforce: 'pre',
        async load(id) {
          const clean = id.split('?')[0];
          const relative = path.relative(root, clean);
          if (!relative.startsWith(`src${path.sep}`)) return null;
          // Read original tracked source from the separate baseline checkout; no app stub.
          return await readFile(path.join(sourceRoot, relative), 'utf8');
        },
      }] : [],
      server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
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
