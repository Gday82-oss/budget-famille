// Service worker : garde l'appli sur le téléphone pour l'ouvrir même sans réseau.
// Les données (Supabase) ne passent pas par ici : elles sont gérées par l'appli.
const VERSION = '__VERSION__';
const FICHIERS = __FICHIERS__;
const CACHE = `budget-${VERSION}`;

self.addEventListener('install', (e) => {
  // cache: 'reload' : on va chercher les fichiers sur le serveur, jamais dans le cache du navigateur
  // (sinon GitHub Pages, qui garde les fichiers 10 min, pouvait glisser l'ancien app.js dans la nouvelle version)
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((k) => k.startsWith('budget-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE }).then((r) => r || fetch(req)));
});
