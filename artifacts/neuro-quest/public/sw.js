self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "NeuroQuest";
  const options = {
    body: data.body || "Your mind awaits.",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
    actions: [
      { action: "play", title: "Train Now" },
      { action: "dismiss", title: "Later" }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const found = list.find(c => c.url.includes(targetUrl));
      if (found) { found.focus(); return; }
      return clients.openWindow(targetUrl);
    })
  );
});
