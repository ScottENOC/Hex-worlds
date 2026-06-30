const CACHE_NAME = 'divine-right-cache-v2';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './state.js',
  './utils.js',
  './drawing.js',
  './mapData.js',
  './unitData.js',
  './scenarioLoader.js',
  './multiplayer.js',
  './retreat.js',
  './phase1Event.js',
  './phase2DiploCards.js',
  './phase3diplomacy.js',
  './phase4siege.js',
  './phase5Movement.js',
  './phase6combatDeclaration.js',
  './phase7CombatResolution.js',
  './eaterSpells.js',
  './blackhand.js',
  './greystaff.js',
  './cpuAI.js',
  './index.js',
  './setup.js',
  './panZoom.js',
  './scenarios/board-game/scenario.json',
  './scenarios/board-game/map.json',
  './scenarios/board-game/units.json',
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