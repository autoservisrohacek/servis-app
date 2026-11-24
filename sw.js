
const CACHE_NAME = 'autoservice-pro-v3';
const STATIC_ASSETS = [
  './',
  'index.html',
  'index.tsx',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install Event - Pre-cache critical files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching critical assets');
      // Používáme addAll s odchycením chyb pro jednotlivé soubory
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => 
          cache.add(asset).catch(err => console.warn(`Failed to cache asset: ${asset}`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Strategic Caching (Network First, then Cache)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Ignorujeme Google API pro AI funkce (vyžadují online připojení)
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Fallback na index.html pro navigaci v SPA
          if (event.request.mode === 'navigate') {
            return caches.match('index.html') || caches.match('./');
          }
          
          return null;
        });
      })
  );
});
