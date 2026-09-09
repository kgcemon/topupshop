// Tombstone for the removed PWA service worker.
//
// Deleting this file outright would NOT have removed anything: a browser that
// already registered the old worker only drops it if an update fetch succeeds
// and the new script tells it to go away. A 404 aborts the update and leaves
// the old worker installed — still intercepting fetches and still serving its
// cache-first copies of /images/ and /favicon.ico, indefinitely.
//
// So this file stays, does the uninstall, and can be deleted once the visitors
// who had the old worker have been back (a few weeks is plenty).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();

      // Reload open tabs so they stop being served by this worker.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })()
  );
});
