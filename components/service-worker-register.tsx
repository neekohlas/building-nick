'use client'

import { useEffect, Suspense, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// IndexedDB helper to check for pending navigation (same DB as SW uses)
const DB_NAME = 'building-nick-sw'
const STORE_NAME = 'navigation'

async function checkAndClearPendingNavigation(): Promise<{ url: string; timestamp: number } | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onerror = () => resolve(null)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => {
        const db = request.result
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          const getRequest = store.get('pending')

          getRequest.onsuccess = () => {
            const data = getRequest.result
            if (data) {
              // Delete it immediately
              store.delete('pending')
            }
            db.close()
            resolve(data || null)
          }
          getRequest.onerror = () => {
            db.close()
            resolve(null)
          }
        } catch {
          db.close()
          resolve(null)
        }
      }
    } catch {
      resolve(null)
    }
  })
}

function ServiceWorkerRegisterInner() {
  const router = useRouter()
  const pathname = usePathname()

  // Check IndexedDB for pending navigation from notification click
  const checkNavigation = useCallback(async () => {
    console.log('[SW Register] Checking IndexedDB for pending navigation')
    const pending = await checkAndClearPendingNavigation()

    if (pending) {
      // Only use if less than 60 seconds old
      if (Date.now() - pending.timestamp < 60000) {
        console.log('[SW Register] Found pending navigation:', pending.url, 'current:', pathname)
        if (pathname !== pending.url) {
          console.log('[SW Register] Navigating to:', pending.url)
          router.replace(pending.url)
        }
      } else {
        console.log('[SW Register] Pending navigation expired')
      }
    }
  }, [pathname, router])

  // Check on mount and when visibility changes
  useEffect(() => {
    // Check immediately on mount
    checkNavigation()

    // Check when app becomes visible (iOS resumes from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SW Register] App became visible')
        checkNavigation()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also check on focus (backup)
    const handleFocus = () => {
      console.log('[SW Register] Window focused')
      checkNavigation()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkNavigation])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Register] Service workers not supported')
      return
    }

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      console.log('[SW Register] Message from SW:', event.data)

      // SW is telling us to check IndexedDB for navigation
      if (event.data?.type === 'CHECK_NAVIGATION') {
        console.log('[SW Register] SW requested navigation check')
        checkNavigation()
      }

      // Direct navigation request (if app is active)
      if (event.data?.type === 'NAVIGATE' && event.data?.url) {
        console.log('[SW Register] Direct navigation to:', event.data.url)
        router.push(event.data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    // Register the service worker with update check
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW Register] Service worker registered:', registration.scope)

        // Force check for updates
        registration.update()

        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('[SW Register] New service worker found')
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('[SW Register] Service worker state:', newWorker.state)
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available, skip waiting
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          }
        })

        // Listen for controller change to reload
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW Register] Controller changed, new SW active')
        })
      })
      .catch((error) => {
        console.error('[SW Register] Service worker registration failed:', error)
      })

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [router, checkNavigation])

  return null
}

export function ServiceWorkerRegister() {
  return (
    <Suspense fallback={null}>
      <ServiceWorkerRegisterInner />
    </Suspense>
  )
}
