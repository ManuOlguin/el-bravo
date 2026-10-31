/* Service worker de El Bravo (versión base, W0-B).
 * Sin cache offline a propósito (YAGNI).
 * W2-3: handlers de Web Push ("push" y "notificationclick"). El payload lo arma
 * src/server/notifications/push.ts: { title, body?, icon, badge, image?, tag?, href }.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "El Bravo" };
  }
  const title = data.title || "El Bravo";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    data: { href: data.href || "/notifications" },
  };
  if (data.image) options.image = data.image;
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/notifications";
  const target = new URL(href, self.location.origin);
  // Solo rutas propias: nunca abrir un origen externo desde una notificación.
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/notifications";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(url);
            return;
          } catch {
            // ventana no controlada por este SW: abrir una nueva
          }
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
