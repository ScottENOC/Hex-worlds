const CACHE_NAME = 'divine-right-cache-v1';
const urlsToCache = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/state.js',
  '/utils.js',
  '/drawing.js',
  '/mapData.js',
  '/unitData.js',
  '/main.js',

  '/scripts/phase1Event.js',
  '/scripts/phase2DiploCards.js',
  '/scripts/phase3diplomacy.js',
  '/scripts/phase4siege.js',
  '/scripts/phase5Movement.js',
  '/scripts/phase6combatDeclaration.js',
  '/scripts/phase7CombatResolution.js',

  // Add any icons, images, sounds, etc. used by your game
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});