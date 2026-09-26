self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Cammino Imperiale",
      body: event.data ? event.data.text() : "Hai una nuova notifica.",
    };
  }

  const title = payload.title || "Cammino Imperiale";
  const options = {
    body: payload.body || "Hai una nuova notifica.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || undefined,
    data: {
      href: payload.href || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || "/", self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client && client.url === target) return client.focus();
        }
        for (const client of windows) {
          if ("navigate" in client && "focus" in client) {
            return client.navigate(target).then(() => client.focus());
          }
        }
        return clients.openWindow(target);
      })
  );
});
