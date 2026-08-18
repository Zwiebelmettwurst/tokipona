// Hält den Prototyp offline verfügbar und lässt neue Fassungen schnell durch.
// Die Fassungsnummer setzt prototype/build.py aus dem Inhalt ein — jede
// Änderung ergibt einen neuen Cache-Namen, alte Bestände fliegen beim
// Aktivieren raus.
const VERSION = '434028d72a';
const CACHE = `o-toki-${VERSION}`;
const SHELL = ['./prototype.html', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' umgeht den HTTP-Cache: sonst legt eine frische Fassung
    // womöglich wieder die alten Dateien ab.
    await Promise.all(SHELL.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Netz zuerst, Cache nur als Rückfall — mit kurzer Geduld, damit ein zähes
// Netz nicht die ganze App aufhält.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = caches.match(event.request);
    try {
      const fresh = await Promise.race([
        fetch(event.request, { cache: 'no-store' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('langsam')), 3500)),
      ]);
      const copy = fresh.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return fresh;
    } catch (error) {
      return (await cached) || (await caches.match('./prototype.html'))
        || Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  // Die Seite kann eine wartende Fassung sofort übernehmen lassen …
  if (event.data === 'skip-waiting') self.skipWaiting();
  // … und nachfragen, welche Fassung hier gerade bedient wird. Der Vergleich
  // mit der eigenen Nummer ist der einzige verlässliche Hinweis darauf, dass
  // die angezeigte Seite veraltet ist.
  if (event.data === 'version' && event.ports && event.ports[0]) {
    event.ports[0].postMessage(VERSION);
  }
});
