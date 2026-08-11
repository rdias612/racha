// Service worker mínimo para qualificar o app como PWA instalável.
// Estratégia: stale-while-revalidate para tudo, sem cache agressivo de
// longa duração. Foco em habilitar a instalação, não em offline-first.
const CACHE = "racha-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const id = payload.partida_id || payload.id;
  const url = payload.url || (id ? `/partida/${id}/votar` : "/");
  event.waitUntil(
    self.registration.showNotification(payload.title || "Racha", {
      body: payload.body || "Há uma votação de partida pendente.",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Apenas GET; ignora requisições para APIs externas (Supabase).
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          // Cacheia apenas respostas válidas (status 200, tipo básico).
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
