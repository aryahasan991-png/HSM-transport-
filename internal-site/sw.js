"use strict";

// HSM INTERNAL - SERVICE WORKER
// Tidak menyimpan data admin atau manifest.

const CACHE_NAME = "hsm-internal-v1";

const STATIC_ASSETS = [
  "/hsm-logo.png",
  "/hsm-apk-icon.png",
  "/hsm_scan_success.wav",
  "/hsm_scan_error.wav"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url))
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("hsm-internal-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (!STATIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request);
    })
  );
});
