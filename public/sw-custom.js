/**
 * Building Nick - Custom Service Worker for Push Notifications
 *
 * This file extends the next-pwa generated service worker with custom
 * notification handling logic.
 */

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag)

  event.notification.close()

  // Get the URL from notification data, default to root
  const url = event.notification.data?.url || '/'

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Handle notification close (user dismissed without clicking)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag)
})

// Handle push events (for future server-side push notifications)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event)

  if (!event.data) {
    console.log('[SW] Push with no data')
    return
  }

  try {
    const data = event.data.json()
    const { title, body, tag, url } = data

    const options = {
      body: body || 'Time to check in on your activities!',
      tag: tag || 'building-nick',
      icon: '/apple-icon.png',
      badge: '/icon-light-32x32.png',
      vibrate: [100, 50, 100],
      requireInteraction: false,
      data: {
        url: url || '/',
        timestamp: new Date().toISOString()
      }
    }

    event.waitUntil(
      self.registration.showNotification(title || 'Building Nick', options)
    )
  } catch (e) {
    console.error('[SW] Failed to handle push:', e)
  }
})

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, tag } = event.data

    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        tag: tag || 'building-nick-scheduled',
        icon: '/apple-icon.png',
        badge: '/icon-light-32x32.png',
        vibrate: [100, 50, 100],
        requireInteraction: false,
        data: {
          url: '/',
          timestamp: new Date().toISOString()
        }
      })
    }, delay)

    // Respond to confirm scheduling
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ scheduled: true, delay })
    }
  }

  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data

    self.registration.showNotification(title, {
      body,
      tag: tag || 'building-nick',
      icon: '/apple-icon.png',
      badge: '/icon-light-32x32.png',
      vibrate: [100, 50, 100],
      requireInteraction: false,
      data: {
        url: '/',
        timestamp: new Date().toISOString()
      }
    })
  }
})

console.log('[SW] Custom service worker loaded')
