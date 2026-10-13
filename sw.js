// Service worker de Butaca (solo la web/PWA: la app de Android no lo lleva).
// - App shell: red primero (siempre la última versión) con la caché de respaldo.
// - Carátulas (imágenes): caché primero, para que tu biblioteca se vea offline.
//   Con tope: guarda las IMG_MAX más recientes y tira las más antiguas. Antes
//   compartían caché con el shell y crecían sin límite con cada búsqueda y cada
//   carta del deck.
// - Peticiones a APIs (búsquedas): pasan de largo, nunca se sirven rancias.

const SHELL_CACHE = "butaca-v2";
const IMG_CACHE = "butaca-img-v1";
const IMG_MAX = 400; // de sobra para una videoteca grande; ~10-20 MB de carátulas
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
});

// fuera cualquier caché que no sea de esta versión (incluida la antigua «butaca-v1»,
// que mezclaba shell y carátulas sin tope)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Guarda la carátula y, si se pasa del tope, tira las más antiguas (orden de entrada). */
async function keepImage(req, res) {
  const c = await caches.open(IMG_CACHE);
  try {
    await c.put(req, res.clone());
  } catch {
    // sin cuota: el navegador «infla» mucho lo que viene de otros dominios (unos MB
    // por carátula a efectos de cuota), así que se puede llenar antes del tope.
    // Fuera el cuarto más antiguo y otra vez.
    const old = await c.keys();
    await Promise.all(old.slice(0, Math.ceil(old.length / 4)).map((k) => c.delete(k)));
    await c.put(req, res);
  }
  const keys = await c.keys();
  if (keys.length > IMG_MAX) await Promise.all(keys.slice(0, keys.length - IMG_MAX).map((k) => c.delete(k)));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // guardar en caché sin retrasar la respuesta; si el navegador no deja alargar
  // el evento, se guarda igual (y nunca rompe la imagen o la página)
  const later = (p) => { p = p.catch(() => {}); try { e.waitUntil(p); } catch { /* sigue en marcha */ } };

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          later(caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy)));
          return r;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true, cacheName: SHELL_CACHE }))
    );
    return;
  }

  if (e.request.destination === "image") {
    e.respondWith(
      caches.match(e.request, { cacheName: IMG_CACHE }).then(
        (hit) =>
          hit ||
          fetch(e.request).then((r) => {
            later(keepImage(e.request, r.clone()));
            return r;
          })
      )
    );
  }
  // resto (APIs JSON): directo a la red
});
