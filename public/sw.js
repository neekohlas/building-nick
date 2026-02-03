/**
 * Building Nick - Custom Service Worker for Push Notifications
 * Version: 3
 *
 * This file handles push notifications and notification interactions.
 */

const SW_VERSION = 12
console.log('[SW] Service worker version:', SW_VERSION)

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version', SW_VERSION)
  self.skipWaiting()
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v12] Notification clicked:', event.notification.tag)

  event.notification.close()

  // Get the URL from notification data, default to Today page
  const targetUrl = event.notification.data?.url || '/today'
  // Add a hash to signal this came from a notification - hashes work better on iOS
  const urlWithHash = new URL(targetUrl, self.location.origin)
  urlWithHash.hash = 'from_notification=' + Date.now()
  const fullUrl = urlWithHash.href

  console.log('[SW v12] Opening URL:', fullUrl)

  // On iOS PWA, the most reliable approach is to ALWAYS use openWindow
  // This forces iOS to open the app to the specified URL
  event.waitUntil(
    (async () => {
      // Always open a new window to the target URL
      // This is the most reliable way to navigate on iOS
      if (clients.openWindow) {
        console.log('[SW v12] Using openWindow for reliable navigation')
        return clients.openWindow(fullUrl)
      }
    })()
  )
})

// Handle notification close (user dismissed without clicking)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag)
})

// Handle push events (for server-side push notifications)
self.addEventListener('push', (event) => {
  console.log('[SW v7] Push event received!')

  // CRITICAL: On iOS, we must show a notification synchronously within waitUntil
  // Create the notification promise immediately
  const notificationPromise = (async () => {
    // Default notification in case of any issues
    let title = 'Building Nick'
    let body = 'Time to check in on your activities!'
    let tag = 'building-nick-push'

    // URL to open when notification is clicked (default to Today page)
    let url = '/today'

    // Try to parse push data if available
    if (event.data) {
      try {
        const data = event.data.json()
        title = data.title || title
        body = data.body || body
        tag = data.tag || tag
        url = data.url || url
        console.log('[SW v7] Push data parsed:', { title, body, tag, url })
      } catch (e) {
        // Try as text
        try {
          body = event.data.text() || body
          console.log('[SW v7] Push data as text:', body)
        } catch (e2) {
          console.error('[SW v7] Failed to parse push data:', e, e2)
        }
      }
    } else {
      console.log('[SW v7] Push with no data, using defaults')
    }

    // iOS requires minimal options - keep it simple but include data for click handler
    try {
      await self.registration.showNotification(title, {
        body: body,
        tag: tag,
        icon: '/apple-icon.png',
        data: { url: url }
      })
      console.log('[SW v7] Notification shown successfully')
    } catch (err) {
      console.error('[SW v7] Failed to show notification:', err)
      // Absolute minimal fallback
      await self.registration.showNotification(title, { body: body, data: { url: url } })
    }
  })()

  event.waitUntil(notificationPromise)
})

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW v10] Message received:', event.data)

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW v10] Skip waiting requested')
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

console.log('[SW v12] Custom service worker loaded')
