/**
 * Building Nick - Custom Service Worker for Push Notifications
 * Version: 3
 *
 * This file handles push notifications and notification interactions.
 */

const SW_VERSION = 13
console.log('[SW] Service worker version:', SW_VERSION)

// IndexedDB helper for storing navigation intent (works in SW, unlike localStorage)
const DB_NAME = 'building-nick-sw'
const STORE_NAME = 'navigation'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function setPendingNavigation(url) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ url, timestamp: Date.now() }, 'pending')
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    console.log('[SW v13] Stored pending navigation in IndexedDB:', url)
  } catch (e) {
    console.error('[SW v13] Failed to store in IndexedDB:', e)
  }
}

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version', SW_VERSION)
  self.skipWaiting()
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v13] Notification clicked:', event.notification.tag)

  event.notification.close()

  // Get the URL from notification data, default to Today page
  const targetUrl = event.notification.data?.url || '/today'

  console.log('[SW v13] Target URL:', targetUrl)

  event.waitUntil(
    (async () => {
      // Store navigation intent in IndexedDB FIRST (this persists!)
      await setPendingNavigation(targetUrl)

      // Try to find existing clients and notify them
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      console.log('[SW v13] Found', clientList.length, 'clients')

      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          console.log('[SW v13] Notifying client and focusing')
          // Tell client to check IndexedDB
          client.postMessage({ type: 'CHECK_NAVIGATION' })
          try {
            await client.focus()
          } catch (e) {
            console.log('[SW v13] Focus failed:', e)
          }
          return
        }
      }

      // No existing client, open new window
      console.log('[SW v13] No client, opening window')
      if (clients.openWindow) {
        const fullUrl = new URL(targetUrl, self.location.origin).href
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

console.log('[SW v13] Custom service worker loaded')
