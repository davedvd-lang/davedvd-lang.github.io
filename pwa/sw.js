// Service worker de Butaca: la app funciona sin conexión.
// - App shell: red primero (siempre la última versión) con la caché de respaldo.
// - Carátulas (imágenes): caché primero, para que tu biblioteca se vea offline.
// - Peticiones a APIs (búsquedas): pasan de largo, nunca se sirven rancias.

const CACHE = "butaca-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  if (e.request.destination === "image") {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((r) => {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return r;
          })
      )
    );
  }
  // resto (APIs JSON): directo a la red
});
