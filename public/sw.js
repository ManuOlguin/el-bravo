/* Service worker de El Bravo (versión base, W0-B).
 * Sin cache offline a propósito (YAGNI). W2-3 agrega acá los handlers de push
 * ("push" y "notificationclick").
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
