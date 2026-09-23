const CACHE_NAME = 'divine-right-cache-v7';
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
  './navalRules.js',
  './diplomacyAdvanced.js',
  './siegeAdvanced.js',
  './siegeResolution.js',
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
  './scenarios/custom/scenario.json',
  './scenarios/custom/map.json',
  './scenarios/custom/units.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(cacheNames.map(cacheName => cacheName !== CACHE_NAME ? caches.delete(cacheName) : null))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
