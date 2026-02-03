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

        // Listen for controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW Register] Controller changed, new SW active')
        })
      })
      .catch((error) => {
        console.error('[SW Register] Service worker registration failed:', error)
      })
  }, [])

  return null
}
