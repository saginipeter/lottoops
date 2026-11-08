const CACHE_NAME = "lottoops-static-v3";
const APP_SHELL = ["/brand/lottoops-logo-new.png"];
const PUBLIC_BRAND_PATHS = new Set([
  "/brand/lottoops-logo-new.png",
  "/brand/lottoops-logo-transparent.png",
  "/brand/lottoops-logo.png",
  "/brand/lottoops-lq-logo.svg",
  "/brand/lottoops-pwa-192.png",
  "/brand/lottoops-pwa-512.png",
]);
const CACHE_PREFIX = "lottoops-";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Never cache or fall back to a protected HTML/RSC document. In particular,
  // a failed navigation must not render another user's previous dashboard.
  if (request.destination === "document") return;

  // Cache only public brand assets. Store artwork, Next image responses, API,
  // RSC, scripts, and every other response remain network-only between users.
  const pathname = new URL(request.url).pathname;
  if (request.destination !== "image" || !PUBLIC_BRAND_PATHS.has(pathname)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cacheControl = response.headers.get("cache-control") ?? "";
        const isPrivate = /\b(private|no-store|no-cache)\b/i.test(cacheControl);
        if (response.ok && !isPrivate && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error()),
  );
});
