/**
 * Building Nick - Custom Service Worker for Push Notifications
 *
 * This file handles push notifications and notification interactions.
 * Note: iOS PWAs have a known bug where notification clicks don't reliably
 * navigate to specific URLs - they just open the app to its last state.
 */

const SW_VERSION = 15
console.log('[SW] Service worker version:', SW_VERSION)

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version', SW_VERSION)
  self.skipWaiting()
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag)
  event.notification.close()

  // Get the URL from notification data, default to Today page
  const targetUrl = event.notification.data?.url || '/today'
  const fullUrl = new URL(targetUrl, self.location.origin).href

  // Try to focus existing window or open new one
  // Note: iOS may ignore the URL and just open the app to its last state
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
        return clients.openWindow(fullUrl)
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
  console.log('[SW] Push event received!')

  // CRITICAL: On iOS, we must show a notification synchronously within waitUntil
  const notificationPromise = (async () => {
    let title = 'Building Nick'
    let body = 'Time to check in on your activities!'
    let tag = 'building-nick-push'
    let url = '/today'

    // Try to parse push data if available
    if (event.data) {
      try {
        const data = event.data.json()
        title = data.title || title
        body = data.body || body
        tag = data.tag || tag
        url = data.url || url
        console.log('[SW] Push data parsed:', { title, body, tag, url })
      } catch (e) {
        try {
          body = event.data.text() || body
          console.log('[SW] Push data as text:', body)
        } catch (e2) {
          console.error('[SW] Failed to parse push data:', e, e2)
        }
      }
    }

    // iOS requires minimal options
    try {
      await self.registration.showNotification(title, {
        body: body,
        tag: tag,
        icon: '/apple-icon.png',
        data: { url: url }
      })
      console.log('[SW] Notification shown successfully')
    } catch (err) {
      console.error('[SW] Failed to show notification:', err)
      await self.registration.showNotification(title, { body: body, data: { url: url } })
    }
  })()

  event.waitUntil(notificationPromise)
})

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested')
    self.skipWaiting()
  }
})

// Claim clients immediately when activated
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated, claiming clients')
  event.waitUntil(self.clients.claim())
})

console.log('[SW] Custom service worker loaded')
