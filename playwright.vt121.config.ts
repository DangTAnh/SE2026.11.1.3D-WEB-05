import { defineConfig } from '@playwright/test';
import original from './playwright.config.ts';
export default defineConfig({ ...original, webServer: undefined, testMatch: ['undoImportV2.spec.ts', 'vt121-load.spec.ts'], retries: 0 });
