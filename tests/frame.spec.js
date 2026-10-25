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
