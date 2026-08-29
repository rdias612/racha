// Service Worker - Súmula de Quinta (Racha Gragoatá CBO)
// Estratégias: NetworkFirst com fallback offline para API Supabase (GET) e
// NetworkFirst/CacheFirst para App Shell e Assets. O stale-while-revalidate de
// dados vive apenas no hook useCache (memória) — no HTTP ele serviria resposta
// atrasada após mutações (ex.: quitar dívidas e a lista não atualizar).

const CACHE_STATIC = 'racha-static-v3';
const CACHE_API = 'racha-api-v2';
const OFFLINE_URL = '/offline.html';

// Configuração do Web Push, injetada no build pelo plugin do vite.config.ts
// (arquivos de public/ não passam pelo pipeline de import.meta.env). Variável
// ausente mantém o placeholder: o push fica no-op (ex.: dev sem VAPID).
const CONFIG_PUSH = {
  supabaseUrl: '__SUPABASE_URL__',
  supabaseAnonKey: '__SUPABASE_ANON_KEY__',
  vapidPublicKey: '__VAPID_PUBLIC_KEY__',
};

const pushConfigurado = [
  CONFIG_PUSH.supabaseUrl,
  CONFIG_PUSH.supabaseAnonKey,
  CONFIG_PUSH.vapidPublicKey,
].every((valor) => valor && !valor.startsWith('__'));

function chaveVapidBytes() {
  const padding = '='.repeat((4 - (CONFIG_PUSH.vapidPublicKey.length % 4)) % 4);
  const base64 = (CONFIG_PUSH.vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binaria = atob(base64);
  const bytes = new Uint8Array(binaria.length);
  for (let i = 0; i < binaria.length; i++) bytes[i] = binaria.charCodeAt(i);
  return bytes;
}

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
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const id = payload.partida_id || payload.id;
  const url = payload.url || (id ? `/partida/${id}/votar` : '/');
  const tagNotificacao = payload.tag || (id ? `votar-partida-${id}` : 'racha-notificacao-geral');
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Racha', {
      body: payload.body || 'Há uma nova notificação do racha.',
      data: { url },
      tag: tagNotificacao,
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

// O navegador invalida inscrições com o app fechado (rotação de token FCM no
// Android, revogação em PWAs dormentes no iOS, evicção de storage). Re-inscreve
// e sincroniza o novo endpoint via RPC que casa pela linha do endpoint antigo —
// o SW não sabe o jogador_id; se a linha já foi limpa por 404/410, o boot do
// app recupera pelo re-check silencioso de sincronizarPush().
self.addEventListener('pushsubscriptionchange', (event) => {
  if (!pushConfigurado) return;
  event.waitUntil(reinscreverPushSubscription(event.oldSubscription, event.newSubscription));
});

async function reinscreverPushSubscription(oldSubscription, newSubscription) {
  try {
    let subscription = newSubscription || null;
    if (!subscription) {
      const existente = await self.registration.pushManager.getSubscription();
      // Só serve se for uma inscrição nova; igual ao endpoint antigo = morta.
      if (existente && oldSubscription && existente.endpoint !== oldSubscription.endpoint) {
        subscription = existente;
      }
    }
    if (!subscription) {
      subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveVapidBytes(),
      });
    }

    const keys = subscription.toJSON().keys || {};
    if (!keys.p256dh || !keys.auth) return;

    const resposta = await fetch(
      `${CONFIG_PUSH.supabaseUrl}/rest/v1/rpc/sincronizar_push_subscription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG_PUSH.supabaseAnonKey,
          Authorization: `Bearer ${CONFIG_PUSH.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          p_endpoint_antigo: oldSubscription ? oldSubscription.endpoint : null,
          p_endpoint_novo: subscription.endpoint,
          p_p256dh: keys.p256dh,
          p_auth: keys.auth,
        }),
      }
    );
    if (!resposta.ok) {
      console.warn('[SW] Sincronização da inscrição push falhou:', resposta.status);
    }
  } catch (err) {
    console.warn('[SW] Falha ao renovar a inscrição push:', err);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Apenas requisições GET são cacheadas. POST, PATCH, PUT, DELETE passam direto.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. Requisições da API REST do Supabase (GET /rest/v1/...)
  // Estratégia: NetworkFirst — online devolve sempre dado fresco (o cache HTTP
  // é apenas reserva offline); sem rede, serve a última resposta conhecida.
  const isSupabaseGet =
    url.pathname.startsWith('/rest/v1/') ||
    (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/v1/'));

  if (isSupabaseGet) {
    event.respondWith(
      caches.open(CACHE_API).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          throw new Error('Requisição indisponível offline');
        }
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
