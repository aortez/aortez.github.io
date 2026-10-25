import {test,expect} from '@playwright/test';
test('installed shell and photo draft open offline without caching frame requests',async({page,context})=>{
 await page.route('http://inky-soup.local:8000/**',route=>route.fulfill({json:route.request().url().endsWith('/api/images')?[]:{width:1600,height:1200,thumb_width:150,thumb_height:112,model:'impression-13.3-2025'}}));
 await page.goto('/frame/');await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.locator('#connect').click();await expect(page.locator('#pick-photo')).toBeEnabled();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=15;c.getContext('2d').fillRect(0,0,20,15);return c.toDataURL().split(',')[1];});
 await page.locator('#photo').setInputFiles({name:'offline.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await expect(page.locator('#send')).toBeEnabled();
 await page.reload();await expect(page.locator('#send')).toBeEnabled();
 const cdp=await context.newCDPSession(page);
 const install=await cdp.send('Page.getInstallabilityErrors');
 expect(install.installabilityErrors).toEqual([]);
 await page.unroute('http://inky-soup.local:8000/**');
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#draft-name')).toHaveText('offline.png');
 await expect(page.locator('#preview')).toBeVisible();
 await expect(page.locator('#connection-status')).toContainText('offline');
 await expect(page.locator('#send')).toBeDisabled();
 await expect(page.locator('#fit')).toBeEnabled();
 await page.locator('#fit').selectOption('cover');
 await expect(page.locator('#preview-status')).toContainText('Ready.');
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#fit')).toHaveValue('cover');
 const keys=await page.evaluate(async()=>{const output=[];for(const name of await caches.keys())for(const req of await(await caches.open(name)).keys())output.push(req.url);return output;});
 expect(keys.length).toBeGreaterThan(5);expect(keys.every(url=>url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
});


test('active app version launches without fetching a newer HTML shell', async ({page}) => {
  await page.goto('/frame/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  let navigations = 0;
  await page.route('**/frame/', route => {
    navigations++;
    return route.fulfill({contentType: 'text/html', body: '<h1>Different release</h1>'});
  });
  await page.reload();
  await expect(page.locator('#editor-heading')).toHaveText('A new view.');
  expect(navigations).toBe(0);
});


test('production artifact retains the Go demo runtime and binary', async ({page, request}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const wasm = await request.get('/main.wasm');
  expect(wasm.ok()).toBe(true);
  expect((await wasm.body()).subarray(0,4)).toEqual(Buffer.from([0,97,115,109]));
  const runtime = await request.get('/wasm_exec.js');
  expect(runtime.ok()).toBe(true);
  expect(await runtime.text()).toContain('class');
  await page.goto('/go.html');
  await expect(page.locator('#fps')).not.toHaveText('0');
  expect(errors).toEqual([]);
});
