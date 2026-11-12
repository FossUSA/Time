const CACHE_NAME = 'foss-mytime-shell-v12';
const SHELL = ['/', '/index.html', '/manifest.json', '/foss-icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    // Activate the cache-policy fix immediately. It does not reload pages or
    // touch their pending local record edits.
    await self.skipWaiting();
  })());
});
self.addEventListener('message', event => { if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // v6 keeps API responses network-only and refreshes the app shell quietly.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Cloud APIs must always reach the network. Never serve or store a cached
  // D1 snapshot: doing so makes optimistic revision checks fail indefinitely.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/', copy));
      }
      return response;
    }).catch(() => caches.match('/') || caches.match('/index.html')));
    return;
  }

  // Cache only the small, versioned app shell. Do not cache arbitrary GETs,
  // query-string update checks, account data, or API responses.
  if (!SHELL.includes(url.pathname) || url.search) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
