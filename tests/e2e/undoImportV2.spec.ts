import { test, expect } from './vt121Transport.ts';
import { cloneConfig, DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { readFile } from 'node:fs/promises';
const fixture = '/tests/e2e/fixtures/renderer-port.html';
const documentA = () => ({ schemaVersion: 2, app: '3D-WEB-05', name: 'After import', config: {
  ...cloneConfig(DEFAULT_CONFIG), mode: 'vortex', backendPreference: 'webgl2',
  simulation: { ...DEFAULT_CONFIG.simulation, particleCount: 32000, speed: 2.2, particleSize: 4 },
  rendering: { ...DEFAULT_CONFIG.rendering, backgroundColor: '#123456', particleColor: '#ff8800', opacity: .7 },
  camera: { enabled: false, autoRotate: true, distance: 45 },
} });
async function exported(page: import('@playwright/test').Page) {
  const wait = page.waitForEvent('download'); await page.locator('#export-preset').click();
  const file = await wait; return JSON.parse(await readFile((await file.path())!, 'utf8'));
}
test('VT121-V2-E1 import and Undo restore complete nested document and port config once', async ({ page }) => {
  await page.goto(fixture);
  await page.locator('#speed').fill('1.8');
  const before = await exported(page);
  const after = documentA();
  await page.locator('#preset-file').setInputFiles({ name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(after)) });
  await expect(page.locator('#mode-vortex')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#particle-count')).toHaveValue('32000');
  expect(await exported(page)).toEqual(after);
  const undo = page.getByRole('button', { name: 'Undo import', exact: true });
  await expect(undo).toBeEnabled({ timeout: 3000 });
  await undo.click();
  expect(await exported(page)).toEqual(before);
  await expect(page.locator('#speed')).toHaveValue('1.8');
  expect(await page.evaluate(() => window.uiTest.port.calls.filter(c => c.type === 'applyConfig').at(-1))).toMatchObject({config: before.config});
  await expect(undo).toBeDisabled();
});

test('VT121-V2-E2 1MB import and byte/JSON rejections preserve complete document/history', async ({page})=>{
 await page.goto(fixture); const before=await exported(page);const after=documentA();
 const raw=JSON.stringify(after).padEnd(1000000,' ');expect(Buffer.byteLength(raw)).toBe(1000000);
 await page.locator('#preset-file').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(raw)});
 await expect(page.locator('#toast')).toContainText('Đã nhập preset hợp lệ');
 for(const [raw,message] of [['','rỗng'],['0','định dạng'],['{}','thiếu'],['{bad','JSON'],[' '.repeat(1000001),'1 MB']]){
  await page.locator('#preset-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(raw)});
  await expect(page.locator('#toast')).toContainText(message);expect(await exported(page)).toEqual(after);
  await expect(page.getByRole('button',{name:'Undo import',exact:true})).toBeEnabled();
 }
 await page.getByRole('button',{name:'Undo import',exact:true}).click();expect(await exported(page)).toEqual(before);
});
test('VT121-V2-E3 manual edit clears history; actual deferred File.text uses latest request wins',async({page})=>{
 await page.goto(fixture);const after=documentA();
 await page.locator('#preset-file').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});
 const undo=page.getByRole('button',{name:'Undo import',exact:true});await expect(undo).toBeEnabled();
 await page.locator('#speed').fill('1.8');await expect(undo).toBeDisabled();
 for(const stale of [JSON.stringify(after),'{invalid']){
  await page.goto(fixture);const before=await exported(page);
  await page.evaluate(stale=>{
   const original=File.prototype.text;
   File.prototype.text=function(){if(this.name==='slow.json')return new Promise<string>(resolve=>{(window as unknown as {vt121Release:()=>void}).vt121Release=()=>resolve(stale);});return original.call(this);};
  },stale);
  await page.locator('#preset-file').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect.poll(()=>page.evaluate(()=>typeof(window as unknown as {vt121Release?:()=>void}).vt121Release)).toBe('function');
  const latest={...after,name:'Latest request'};
  await page.locator('#preset-file').setInputFiles({name:'latest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(latest))});
  await expect(page.locator('#toast')).toContainText('Đã nhập preset hợp lệ');
  await page.evaluate(async()=>{(window as unknown as {vt121Release:()=>void}).vt121Release();await Promise.resolve();await Promise.resolve();});
  await expect(page.locator('#toast')).toHaveText('Đã nhập preset hợp lệ.');
  expect(await exported(page)).toEqual(latest);
  await page.getByRole('button',{name:'Undo import',exact:true}).click();expect(await exported(page)).toEqual(before);
 }
});
test('VT121-V2-E4 partial renderer apply and failed Undo recover UI/port and preserve history',async({page})=>{
 await page.goto(fixture);const before=await exported(page);const after=documentA();
 const failNext=async()=>page.evaluate(()=>{
  const original=window.uiTest.port.applyConfig.bind(window.uiTest.port);let once=true;
  window.uiTest.port.applyConfig=config=>{original(config);if(once){once=false;throw new Error('sensitive partial failure');}};
 });
 await failNext();
 await page.locator('#preset-file').setInputFiles({name:'partial.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});
 await expect(page.locator('#toast')).toContainText('Không thể áp dụng cấu hình');
 expect(await exported(page)).toEqual(before);
 expect(await page.evaluate(()=>window.uiTest.port.calls.filter(c=>c.type==='applyConfig').at(-1))).toMatchObject({config:before.config});
 const undo=page.getByRole('button',{name:'Undo import',exact:true});await expect(undo).toBeDisabled();
 await page.locator('#preset-file').setInputFiles({name:'ok.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});
 await expect(undo).toBeEnabled();await failNext();await undo.click();
 await expect(page.locator('#toast')).toContainText('Không thể áp dụng cấu hình');
 expect(await exported(page)).toEqual(after);
 expect(await page.evaluate(()=>window.uiTest.port.calls.filter(c=>c.type==='applyConfig').at(-1))).toMatchObject({config:after.config});
 await expect(undo).toBeEnabled();await undo.click();expect(await exported(page)).toEqual(before);await expect(undo).toBeDisabled();
});
