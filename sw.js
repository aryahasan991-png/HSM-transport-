"use strict";

/*
  HSM TRANSPORT
  PWA SERVICE WORKER

  Hanya menyimpan aset statis.

  TIDAK menyimpan:
  - Data penumpang
  - Respons Supabase
  - Token login
  - Halaman admin
  - Halaman petugas
  - Data booking
*/

const CACHE_NAME = "hsm-pwa-static-v1";

const STATIC_ASSETS = [
  "/favicon.png",
  "/hsm-apk-icon.png",
  "/hsm_scan_success.wav",
  "/hsm_scan_error.wav"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset))
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
            key.startsWith("hsm-pwa-static-") &&
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

  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  const url = new URL(request.url);

  if (!STATIC_ASSETS.includes(url.pathname)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      return fetch(request);
    })()
  );
});
