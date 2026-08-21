self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'BodegaApliSmart', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    // Con la aplicación visible, el WebSocket actualiza la campana y reproduce
    // el sonido. Evitamos mostrar además una notificación nativa duplicada.
    if (clients.some((client) => client.visibilityState === 'visible')) return
    return self.registration.showNotification(data.title || 'BodegaApliSmart', {
      body: data.body || 'Tienes una nueva notificación.',
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      tag: data.tag || data.id,
      data: { url: data.url || '/', notificationId: data.id },
      renotify: Boolean(data.tag),
    })
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        client.navigate(targetUrl)
        return client.focus()
      }
    }
    return self.clients.openWindow(targetUrl)
  }))
})
