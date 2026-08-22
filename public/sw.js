// Service Worker - Súmula de Quinta (Racha Gragoatá CBO)
// Estratégias: Stale-While-Revalidate para API Supabase (GET) e NetworkFirst/CacheFirst para App Shell e Assets.

const CACHE_STATIC = 'racha-static-v3';
const CACHE_API = 'racha-api-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS_PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/splash/apple-splash-dark.svg',
  '/splash/apple-splash-light.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(ASSETS_PRECACHE))
      .catch((err) => {
        console.warn('[SW] Falha no precache parcial:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const cachesPermitidos = [CACHE_STATIC, CACHE_API];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !cachesPermitidos.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const id = payload.partida_id || payload.id;
  const url = payload.url || (id ? `/partida/${id}/votar` : '/');
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Racha', {
      body: payload.body || 'Há uma votação de partida pendente.',
      data: { url },
      tag: payload.tag || (id ? `votar-partida-${id}` : undefined),
      renotify: true,
      vibrate: [100, 50, 100, 50, 300],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Apenas requisições GET são cacheadas. POST, PATCH, PUT, DELETE passam direto.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. Requisições da API REST do Supabase (GET /rest/v1/...)
  // Estratégia: Stale-While-Revalidate com fallback seguro offline
  const isSupabaseGet =
    url.pathname.startsWith('/rest/v1/') ||
    (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/v1/'));

  if (isSupabaseGet) {
    event.respondWith(
      caches.open(CACHE_API).then(async (cache) => {
        const cached = await cache.match(request);

        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            if (cached) return cached;
            throw err;
          });

        // Se já existe cache, retorna imediatamente (0ms / offline) enquanto revalida em background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 2. Fontes Google (Google Fonts CSS e arquivos WOFF2)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cached || new Response('', { status: 503, statusText: 'Offline' });
        }
      })
    );
    return;
  }

  // 3. Assets da mesma origem (HTML, JS, CSS, Imagens)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        try {
          const network = await fetch(request);
          if (network && network.status === 200 && network.type === 'basic') {
            cache.put(request, network.clone());
          }
          return network;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;

          // Se for navegação de página e falhar sem cache, entrega a tela offline
          if (request.mode === 'navigate') {
            const offlinePage = await cache.match(OFFLINE_URL);
            if (offlinePage) return offlinePage;
          }

          throw new Error('Recurso indisponível offline');
        }
      })
    );
  }
});
