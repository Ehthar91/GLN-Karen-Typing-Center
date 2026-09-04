const CACHE = 'gln-karen-typing-undo-v1';
const ASSETS = [
  './','./index.html','./logo.png','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
  './manifest.webmanifest','./padauk.css','./styles.css?v=undo1','./practice.css','./games.css','./race.css',
  './app.js?v=undo1','./practice.js','./games.js','./race.js','./firebase-config.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html'))));
});
