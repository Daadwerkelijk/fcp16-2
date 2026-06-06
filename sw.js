const CACHE = 'fcp162-v2';
const ASSETS = [
  '/fcp16-2/',
  '/fcp16-2/index.html',
  '/fcp16-2/opstelling.html',
  '/fcp16-2/selectie.html',
  '/fcp16-2/trainen.html',
  '/fcp16-2/wedstrijden.html',
  '/fcp16-2/oefeningen.html',
  '/fcp16-2/team.html',
  '/fcp16-2/instellingen.html',
  '/fcp16-2/spelerformulier.html',
  '/fcp16-2/app.js',
  '/fcp16-2/style.css',
  '/fcp16-2/manifest.json',
  '/fcp16-2/icon-192.png',
  '/fcp16-2/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase, Google Fonts en CDN altijd live ophalen
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('jsdelivr')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // App bestanden: cache-first, bij missen ophalen en cachen
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        const cl = r.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, cl));
        return r;
      });
    })
  );
});
