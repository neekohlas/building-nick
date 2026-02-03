/**
 * Web Push Subscription Management
 *
 * Handles subscribing to and managing push notifications on the client side.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Get the current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch (e) {
    console.error('[Push] Error getting current subscription:', e)
    return null
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  notificationTimes: { hour: number; minute: number }[]
): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    throw new Error('Push not supported')
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID key missing')
  }

  // Wait for service worker with timeout
  console.log('[Push] Waiting for service worker...')
  const registrationPromise = navigator.serviceWorker.ready
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('SW timeout (10s)')), 10000)
  })

  const registration = await Promise.race([registrationPromise, timeoutPromise])
  console.log('[Push] Service worker ready')

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    // Create new subscription
    console.log('[Push] Creating new subscription...')
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
      console.log('[Push] Subscription created:', subscription.endpoint)
    } catch (e) {
      const err = e as Error
      throw new Error(`PushMgr: ${err.message}`)
    }
  } else {
    console.log('[Push] Using existing subscription:', subscription.endpoint)
  }

  // Save subscription to server
  const response = await fetch('/api/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      notificationTimes,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Server ${response.status}: ${text.substring(0, 50)}`)
  }

  console.log('[Push] Subscription saved to server')
  return subscription
}

/**
 * Update notification times for existing subscription
 */
export async function updateNotificationTimes(
  notificationTimes: { hour: number; minute: number }[]
): Promise<boolean> {
  const subscription = await getCurrentSubscription()
  if (!subscription) {
    console.warn('[Push] No subscription to update')
    return false
  }

  try {
    const response = await fetch('/api/push-subscription', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        notificationTimes
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to update times: ${response.status}`)
    }

    console.log('[Push] Notification times updated')
    return true
  } catch (e) {
    console.error('[Push] Error updating times:', e)
    return false
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getCurrentSubscription()
  if (!subscription) {
    console.log('[Push] No subscription to unsubscribe')
    return true
  }

  try {
    // Unsubscribe from browser
    await subscription.unsubscribe()
    console.log('[Push] Unsubscribed from browser')

    // Remove from server
    const response = await fetch(
      `/api/push-subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`,
      { method: 'DELETE' }
    )

    if (!response.ok) {
      console.warn('[Push] Failed to remove from server, but browser unsubscribed')
    }

    return true
  } catch (e) {
    console.error('[Push] Error unsubscribing:', e)
    return false
  }
}
