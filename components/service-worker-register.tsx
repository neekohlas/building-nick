'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) {
      console.log('[SW Register] Service workers not supported')
      return
    }

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW Register] Service worker registered:', registration.scope)

        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('[SW Register] New service worker found')
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('[SW Register] Service worker state:', newWorker.state)
            })
          }
        })
      })
      .catch((error) => {
        console.error('[SW Register] Service worker registration failed:', error)
      })
  }, [])

  return null
}
