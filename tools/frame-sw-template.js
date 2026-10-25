const CACHE = '__CACHE__';
const FILES = __FILES__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('frame-app-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Photo and API requests go directly to the local frame and are never cached here.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && url.pathname.startsWith('/frame/')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, {signal: AbortSignal.timeout(5000)});
        if (response.ok) return response;
      } catch { /* Use the installed shell when the website is unavailable. */ }
      return caches.match('/frame/index.html', {ignoreVary: true});
    })());
  } else if (FILES.includes(url.pathname)) {
    event.respondWith((async () => (await caches.match(event.request, {ignoreVary: true})) || fetch(event.request))());
  }
});
