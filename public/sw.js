/**
 * Building Nick - Custom Service Worker for Push Notifications
 * Version: 2
 *
 * This file handles push notifications and notification interactions.
 */

const SW_VERSION = 2
console.log('[SW] Service worker version:', SW_VERSION)

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

// Handle push events (for server-side push notifications)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event)

  // Default notification in case of any issues
  let title = 'Building Nick'
  let body = 'Time to check in on your activities!'
  let tag = 'building-nick'
  let url = '/'

  // Try to parse push data if available
  if (event.data) {
    try {
      const data = event.data.json()
      title = data.title || title
      body = data.body || body
      tag = data.tag || tag
      url = data.url || url
      console.log('[SW] Push data parsed:', { title, body, tag })
    } catch (e) {
      // Try as text
      try {
        body = event.data.text() || body
        console.log('[SW] Push data as text:', body)
      } catch (e2) {
        console.error('[SW] Failed to parse push data:', e, e2)
      }
    }
  } else {
    console.log('[SW] Push with no data, using defaults')
  }

  const options = {
    body: body,
    tag: tag,
    icon: '/apple-icon.png',
    badge: '/icon-light-32x32.png',
    vibrate: [100, 50, 100],
    requireInteraction: false,
    renotify: true,
    data: {
      url: url,
      timestamp: new Date().toISOString()
    }
  }

  // CRITICAL: iOS requires waitUntil with showNotification for push to work
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification shown successfully'))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  )
})

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested')
    self.skipWaiting()
    return
  }

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

// Claim clients immediately when activated
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated, claiming clients')
  event.waitUntil(self.clients.claim())
})

console.log('[SW] Custom service worker loaded')
