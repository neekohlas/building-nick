'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function ServiceWorkerRegister() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Check if we were opened from a notification and need to navigate
  useEffect(() => {
    const fromNotification = searchParams.get('from_notification')
    if (fromNotification) {
      console.log('[SW Register] Opened from notification, current path:', pathname)
      // Remove the query param and ensure we're on the right page
      // The SW opened us with /today?from_notification=timestamp
      // We need to clean up the URL
      const url = new URL(window.location.href)
      url.searchParams.delete('from_notification')

      // If we're not on /today, navigate there
      if (pathname !== '/today') {
        console.log('[SW Register] Navigating to /today')
        router.replace('/today')
      } else {
        // Just clean up the URL
        window.history.replaceState({}, '', url.pathname)
      }
    }
  }, [searchParams, pathname, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Register] Service workers not supported')
      return
    }

    // Listen for messages from service worker (e.g., navigation requests)
    const handleMessage = (event: MessageEvent) => {
      console.log('[SW Register] Message from SW:', event.data)
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
