'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const PENDING_NAVIGATION_KEY = 'pending_notification_navigation'

function ServiceWorkerRegisterInner() {
  const router = useRouter()
  const pathname = usePathname()

  // Check for pending navigation from notification click (stored in localStorage)
  useEffect(() => {
    const checkPendingNavigation = () => {
      try {
        const pending = localStorage.getItem(PENDING_NAVIGATION_KEY)
        if (pending) {
          const { url, timestamp } = JSON.parse(pending)
          // Only use if less than 30 seconds old
          if (Date.now() - timestamp < 30000) {
            console.log('[SW Register] Found pending navigation:', url, 'current:', pathname)
            localStorage.removeItem(PENDING_NAVIGATION_KEY)
            if (pathname !== url) {
              console.log('[SW Register] Navigating to:', url)
              router.replace(url)
            }
          } else {
            // Expired, remove it
            localStorage.removeItem(PENDING_NAVIGATION_KEY)
          }
        }
      } catch (e) {
        console.error('[SW Register] Error checking pending navigation:', e)
      }
    }

    // Check on mount
    checkPendingNavigation()

    // Also check when app becomes visible (iOS may have suspended it)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SW Register] App became visible, checking pending navigation')
        checkPendingNavigation()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Register] Service workers not supported')
      return
    }

    // Listen for messages from service worker (e.g., navigation requests)
    const handleMessage = (event: MessageEvent) => {
      console.log('[SW Register] Message from SW:', event.data)

      // Store navigation intent in localStorage (survives app restart)
      if (event.data?.type === 'STORE_NAVIGATION' && event.data?.url) {
        console.log('[SW Register] Storing navigation intent:', event.data.url)
        try {
          localStorage.setItem(PENDING_NAVIGATION_KEY, JSON.stringify({
            url: event.data.url,
            timestamp: Date.now()
          }))
        } catch (e) {
          console.error('[SW Register] Failed to store navigation:', e)
        }
      }

      // Immediate navigation request
      if (event.data?.type === 'NAVIGATE' && event.data?.url) {
        console.log('[SW Register] Navigating to:', event.data.url)
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
  }, [router])

  return null
}

export function ServiceWorkerRegister() {
  return (
    <Suspense fallback={null}>
      <ServiceWorkerRegisterInner />
    </Suspense>
  )
}
