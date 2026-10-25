import {test, expect} from '@playwright/test';

const base = 'http://inky-soup.local:8000';
const config = {width:1600,height:1200,thumb_width:150,thumb_height:112,model:'impression-13.3-2025',color:'multi'};
async function mockFrame(page, {failed = false} = {}) {
  let filename;
  const requests=[];
  await page.route(`${base}/**`,async route=>{
    const request=route.request(); const path=new URL(request.url()).pathname;
    requests.push({path,method:request.method()});
    let result;
    if(path==='/api/display-config') result=config;
    else if(path==='/api/images') result=[];
    else if(path==='/api/lock-image') result={locked:true};
    else if(path==='/api/unlock-image') result={unlocked:true};
    else if(path==='/upload') { filename=/filename="([^"]+)"/.exec(request.postData())[1]; result={success:true,filename}; }
    else if(path==='/flash') result={success:true,job_id:1};
    else if(path==='/api/flash/status/1') result={job_id:1,filename,created_at:100,status:failed?'Failed':'Completed',error_message:failed?'Refresh Wait: Timed out after 65.00s':null};
    else result={success:true};
    await route.fulfill({json:result,headers:{'Access-Control-Allow-Origin':'*'}});
  });
  return requests;
}
async function photo(page) {
  // Generate a lossless source on the client; no fixture or network image is needed.
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=1600;c.height=1200;
    const x=c.getContext('2d');['#000','#fff','#ff0','#f00','#00f','#0f0'].forEach((color,i)=>{x.fillStyle=color;x.fillRect(0,i*200,1600,200);});
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#photo').setInputFiles({name:'colors.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#send')).toBeEnabled({timeout:30000});
}

test('mobile editor uses exact panel pixels, keeps its draft, and sends to the frame',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const requests=await mockFrame(page);await page.goto('/frame/');
  await page.locator('#connect').click();await expect(page.locator('#frame-detail')).toContainText('Connected');
  await photo(page);
  expect(await page.locator('#preview').evaluate(img=>[img.naturalWidth,img.naturalHeight])).toEqual([1600,1200]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.reload();await expect(page.locator('#send')).toBeEnabled({timeout:30000});
  await page.locator('#send').click();await expect(page.locator('#activity-title')).toHaveText('Your new view is ready.');
  expect(requests.filter(r=>r.path==='/flash')).toHaveLength(1);
  for (const path of ['/upload','/api/upload-cache','/api/upload-thumb','/api/upload-dithered']) expect(requests.some(r=>r.path===path)).toBe(true);
  // Editing the same saved draft must reuse its original instead of duplicating the gallery.
  await page.locator('#fit').selectOption('cover');
  await expect(page.locator('#send')).toBeEnabled();
  await page.locator('#send').click();
  await expect(page.locator('#send')).toBeEnabled();
  expect(requests.filter(r=>r.path==='/upload')).toHaveLength(1);
  expect(requests.filter(r=>r.path==='/flash')).toHaveLength(2);
});

test('display failure stays a failure and allows a deliberate retry',async({page})=>{
  await mockFrame(page,{failed:true});await page.goto('/frame/');await page.locator('#connect').click();
  await expect(page.locator('#frame-detail')).toContainText('Connected');await photo(page);await page.locator('#send').click();
  await expect(page.locator('#activity-title')).toHaveText('The display could not refresh.');
  await expect(page.locator('#activity-detail')).toContainText('panel did not respond');await expect(page.locator('#send')).toBeEnabled();
});

test('unsafe handoff cannot make requests to a public or credentialed destination',async({page})=>{
  const outgoing=[];page.on('request',r=>outgoing.push(r.url()));
  await page.goto('/frame/#device='+encodeURIComponent('https://user:secret@example.com/'));
  await expect(page.locator('#connection-status')).toContainText('private WiFi IP');
  expect(outgoing.some(url=>url.includes('example.com'))).toBe(false);
});

async function fixturePhoto(page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0,0,64,48); gradient.addColorStop(0,'#184d85'); gradient.addColorStop(1,'#ecc989');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,64,48);
    return canvas.toDataURL().split(',')[1];
  });
  return {name:'sample.png', mimeType:'image/png', buffer:Buffer.from(data,'base64')};
}

async function libraryFrame(page, {locked = false, pending = false, failThumb = false, deleteFailure = false} = {}) {
  let images = [{filename:'saved.png',thumb_ready:true,fit_mode:'cover',filter:'lanczos',brightness:25,contrast:-20,saturation:0.7,dither_algorithm:'atkinson'}];
  let source;
  let thumbFailed = false;
  let status = pending ? 'Flashing' : 'Completed';
  const requests = [];
  await page.route(`${base}/**`, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const body = request.postData() || ''; requests.push({path, body});
    let result;
    if (path === '/api/display-config') result = config;
    else if (path === '/api/images') result = images;
    else if (path.startsWith('/images/')) {await route.fulfill({contentType:'image/png', body:source}); return;}
    else if (path === '/api/lock-image') result = {locked: !locked};
    else if (path === '/api/unlock-image') result = {success:true};
    else if (path === '/upload') {
      const filename = /filename="([^"]+)"/.exec(body)[1]; images.push({filename,thumb_ready:true});
      result = {success:true,filename};
    } else if (path === '/api/upload-thumb' && failThumb && !thumbFailed) {
      thumbFailed = true; await route.fulfill({status:500, json:{message:'Temporary thumbnail failure'}}); return;
    } else if (path === '/api/delete-image') {
      if (deleteFailure) {await route.fulfill({status:409, json:{message:'This photo is queued or refreshing. Wait for the display to finish'}}); return;}
      images = images.filter(image => image.filename !== JSON.parse(body).filename); result = {success:true};
    } else if (path === '/flash') result = {success:true,job_id:1};
    else if (path === '/api/flash/status/1') result = {job_id:1,filename:'saved.png',created_at:100,started_at:Date.now()-5000,status};
    else result = {success:true};
    await route.fulfill({json:result});
  });
  await page.goto('/frame/'); source = (await fixturePhoto(page)).buffer;
  await page.locator('#connect').click(); await expect(page.locator('#frame-detail')).toContainText('Connected');
  return {requests, unlock:()=>{locked=false;}, complete:()=>{status='Completed';}};
}

async function openSaved(page) {
  await page.locator('#gallery-tab').click(); await page.getByRole('button',{name:'saved.png',exact:true}).click();
  await expect(page.locator('#preview-status')).toContainText('Ready.');
}

const multipartField = (body, name) => new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(body)?.[1];

test('saved adjustments survive reopening, saving, and draft recovery without a display refresh', async ({page}) => {
  const {requests} = await libraryFrame(page); await openSaved(page);
  for (const [id,value] of Object.entries({fit:'cover',filter:'lanczos',brightness:'25',contrast:'-20',saturation:'0.7',dither:'atkinson'})) await expect(page.locator(`#${id}`)).toHaveValue(value);
  const display = await page.locator('#preview').getAttribute('src');
  await page.locator('#preview-before').click(); expect(await page.locator('#preview').getAttribute('src')).not.toBe(display);
  await page.locator('#save').click(); await expect(page.locator('#activity-title')).toHaveText('Photo saved.');
  expect(requests.filter(r=>r.path==='/flash' || r.path==='/upload')).toHaveLength(0);
  expect(requests.some(r=>r.path==='/api/lock-image' && JSON.parse(r.body).refresh_only === true)).toBe(true);
  const upload = requests.find(r=>r.path==='/api/upload-dithered').body;
  for (const [key,value] of Object.entries({filter:'lanczos',brightness:'25',contrast:'-20',saturation:'0.7',dither_algorithm:'atkinson'})) expect(multipartField(upload,key)).toBe(value);
  await page.reload(); await expect(page.locator('#send')).toBeEnabled();
  await expect(page.locator('#brightness')).toHaveValue('25'); await expect(page.locator('#dither')).toHaveValue('atkinson');
});

test('refresh progress stays directly below Display this photo and finishes only on reported completion', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const frame = await libraryFrame(page,{pending:true}); await openSaved(page); await page.locator('#send').click();
  await expect(page.locator('#activity-title')).toHaveText('Refreshing your frame…');
  await expect(page.locator('#send-progress')).toBeVisible(); await expect(page.locator('#send-progress')).not.toHaveAttribute('aria-valuenow');
  await expect(page.locator('#send')).toBeDisabled();
  expect(await page.locator('#activity').evaluate(el=>el.parentElement.id)).toBe('send-panel');
  const button = await page.locator('#send').boundingBox(); const progress = await page.locator('#send-progress').boundingBox();
  expect(progress.y).toBeGreaterThan(button.y+button.height); expect(progress.y-button.y-button.height).toBeLessThan(50);
  await page.locator('#job-details summary').click(); await expect(page.locator('#job-info')).toContainText('Job 1 · Flashing');
  frame.complete(); await expect(page.locator('#activity-title')).toHaveText('Your new view is ready.');
  await expect(page.locator('#send-progress')).toHaveAttribute('aria-valuenow','1');
  expect(frame.requests.filter(r=>r.path==='/flash')).toHaveLength(1);
});

test('read-only photo cannot save, delete, or overwrite settings until its edit lock is acquired', async ({page}) => {
  const frame = await libraryFrame(page,{locked:true}); await openSaved(page);
  await expect(page.locator('#lock-status')).toContainText('Read only');
  for (const id of ['save','send','delete','brightness','fit']) await expect(page.locator(`#${id}`)).toBeDisabled();
  frame.unlock(); await page.locator('#retry-edit').click(); await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#lock-status')).toContainText('Editing this photo');
});

test('delete cancellation sends nothing; confirmation removes the library entry but preserves the phone draft', async ({page}) => {
  const {requests} = await libraryFrame(page); await openSaved(page);
  await page.locator('#delete').click(); await page.locator('#cancel-delete').click();
  expect(requests.filter(r=>r.path==='/api/delete-image')).toHaveLength(0);
  await page.locator('#delete').click(); await page.locator('#confirm-delete').click();
  await expect(page.locator('#activity-title')).toHaveText('Photo deleted from the frame.');
  await expect(page.locator('#delete')).toBeHidden(); await expect(page.locator('#preview')).toBeVisible();
  await page.locator('#gallery-tab').click(); await expect(page.locator('#gallery button')).toHaveCount(0);
  expect(requests.filter(r=>r.path==='/flash')).toHaveLength(0);
});

test('server refusal leaves a queued photo and its controls intact', async ({page}) => {
  await libraryFrame(page,{deleteFailure:true}); await openSaved(page);
  await page.locator('#delete').click(); await page.locator('#confirm-delete').click();
  await expect(page.locator('#activity-title')).toHaveText('Could not delete photo');
  await expect(page.locator('#activity-detail')).toContainText('queued or refreshing');
  await expect(page.locator('#delete')).toBeEnabled();
});

test('batch saves photos without flashing and retries partial failures without duplicating originals', async ({page}) => {
  const {requests} = await libraryFrame(page,{failThumb:true}); const file = await fixturePhoto(page);
  await page.locator('#photo').setInputFiles([file,{...file,name:'second.png'}]);
  await expect(page.locator('#import-summary')).toContainText('1 of 2 saved · 1 failed');
  await page.locator('#retry-imports').click(); await expect(page.locator('#import-summary')).toContainText('2 of 2 saved');
  expect(requests.filter(r=>r.path==='/upload')).toHaveLength(2); expect(requests.filter(r=>r.path==='/flash')).toHaveLength(0);
  await expect(page.locator('#gallery button')).toHaveCount(3);
});

test('worker adjustments affect preview pixels, preserve the cache, and produce native ink colors', async ({page}) => {
  await page.goto('/frame/');
  const result = await page.evaluate(async () => {
    const {processPhoto} = await import('/frame/services/processor.js');
    const canvas = new OffscreenCanvas(8,8); const ctx = canvas.getContext('2d');ctx.fillStyle='rgb(100,100,100)';ctx.fillRect(0,0,8,8);
    const blob = await canvas.convertToBlob();
    const pixels = async blob => {const img=await createImageBitmap(blob);const c=new OffscreenCanvas(img.width,img.height);const x=c.getContext('2d');x.drawImage(img,0,0);img.close();return [...x.getImageData(0,0,c.width,c.height).data];};
    const results=[];
    for (const dither of ['floyd-steinberg','atkinson','ordered']) {
      const output=await processPhoto({blob,fit:'cover',filter:'nearest',brightness:20,contrast:50,saturation:0.5,dither},{width:8,height:8,thumb_width:4,thumb_height:4,model:'impression-13.3-2025'});
      const display=await pixels(output.dithered);const colors=new Set();for(let i=0;i<display.length;i+=4)colors.add(display.slice(i,i+4).join(','));
      results.push({cache:(await pixels(output.cache)).slice(0,4),before:(await pixels(output.adjusted)).slice(0,4),colors:[...colors]});
    }
    return results;
  });
  for(const row of result){expect(row.cache).toEqual([100,100,100,255]);expect(row.before).toEqual([106,106,106,255]);for(const color of row.colors)expect(['0,0,0,255','255,255,255,255','255,255,0,255','255,0,0,255','0,0,255,255','0,255,0,255']).toContain(color);}
});


test('a stalled reconnect never blocks editing a restored draft', async ({page}) => {
  await mockFrame(page); await page.goto('/frame/'); await page.locator('#connect').click();
  await expect(page.locator('#pick-photo')).toBeEnabled(); await photo(page);
  await page.unroute(`${base}/**`);
  await page.route(`${base}/**`, () => {}); // Keep requests pending while the browser still reports online.
  await page.reload(); await expect(page.locator('#preview-status')).toContainText('Ready.');
  await expect(page.locator('#frame-detail')).toHaveText('Connecting…');
  await expect(page.locator('#send')).toBeDisabled(); await expect(page.locator('#brightness')).toBeEnabled();
  await page.locator('#brightness').fill('35'); await page.locator('#brightness').dispatchEvent('change');
  await expect(page.locator('#preview-status')).toContainText('Ready.'); await expect(page.locator('#brightness')).toHaveValue('35');
});


test('edit ownership survives reload but is not shared with a second app tab', async ({page,context}) => {
  await mockFrame(page); await page.goto('/frame/');
  const session = await page.evaluate(async () => (await import('/frame/core/state.js')).state.session);
  await page.reload(); expect(await page.evaluate(async () => (await import('/frame/core/state.js')).state.session)).toBe(session);
  const other = await context.newPage(); await mockFrame(other); await other.goto('/frame/');
  expect(await other.evaluate(async () => (await import('/frame/core/state.js')).state.session)).not.toBe(session);
  await other.close();
});
