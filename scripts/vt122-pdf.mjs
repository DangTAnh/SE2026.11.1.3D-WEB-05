import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const html = resolve('docs/04-testing/vt122/report.html');
const output = resolve('BT3_23001846_VT-122.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });

const layout = await page.evaluate(() =>
  [...document.querySelectorAll('.page')].map((element, index) => ({
    page: index + 1,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowPx: element.scrollHeight - element.clientHeight,
  })),
);

console.log(JSON.stringify(layout, null, 2));
const overflowing = layout.filter(item => item.overflowPx > 0);
if (overflowing.length > 0) {
  console.error(`Overflowing pages: ${overflowing.map(item => item.page).join(', ')}`);
}

await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();

console.log(`PDF: ${output}`);
