const CACHE_NAME = 'pub-game-v1';
const urlsToCache = [
  '/',
  '/play',
  '/index.html',
  '/styles.css',
  '/manifest.json'
];

// Installazione: crea la cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Attivazione: pulisci vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimuovo cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: strategia Network First (WebSocket passa sempre)
self.addEventListener('fetch', (event) => {
  // Ignora WebSocket e richieste non-GET
  if (event.request.url.includes('/ws-pubgame') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona la risposta per metterla in cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Se network fallisce, usa cache
        return caches.match(event.request);
      })
  );
});
