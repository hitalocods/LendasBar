const CACHE_NAME = "lendas-2018-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL, "/lendas-logo.png"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      if (event.request.mode === "navigate") {
        const offlinePage = await caches.match(OFFLINE_URL);
        return offlinePage || Response.error();
      }

      const cached = await caches.match(event.request);
      return cached || Response.error();
    })
  );
});
