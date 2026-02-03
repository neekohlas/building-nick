import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

// Configure web-push
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:notifications@building-nick.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

// Motivational messages for notifications
const NOTIFICATION_MESSAGES = [
  { title: "Time to check in!", body: "How's your day going? Let's see what's next." },
  { title: "Quick check-in", body: "Take a moment to review your activities." },
  { title: "Building habits", body: "Small steps lead to big changes. What's on deck?" },
  { title: "Stay on track", body: "Your consistency is building something great." },
  { title: "Momentum check", body: "Keep the streak going! What's next?" },
]

function getRandomMessage() {
  return NOTIFICATION_MESSAGES[Math.floor(Math.random() * NOTIFICATION_MESSAGES.length)]
}

// POST - Send notifications to all subscribers who should receive one at this time
// This should be called by a cron job every minute
export async function POST(request: NextRequest) {
  // Optional auth check - only enforce if CRON_SECRET is set
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // If CRON_SECRET is configured, require it. Otherwise allow all requests.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Send Notifications] Request received')

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get all subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (error) {
      console.error('[Send Notifications] Error fetching subscriptions:', error)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found', sent: 0 })
    }

    const now = new Date()
    const results = {
      checked: subscriptions.length,
      sent: 0,
      failed: 0,
      skipped: 0
    }

    for (const sub of subscriptions) {
      // Get current time in the subscriber's timezone
      let subscriberHour: number
      let subscriberMinute: number

      try {
        const timeInTz = new Date(now.toLocaleString('en-US', { timeZone: sub.timezone }))
        subscriberHour = timeInTz.getHours()
        subscriberMinute = timeInTz.getMinutes()
      } catch {
        // Fallback to UTC if timezone is invalid
        subscriberHour = now.getUTCHours()
        subscriberMinute = now.getUTCMinutes()
      }

      // Check if current time matches any notification time
      const times = sub.notification_times as { hour: number; minute: number }[]
      const shouldSend = times.some(
        t => t.hour === subscriberHour && t.minute === subscriberMinute
      )

      if (!shouldSend) {
        results.skipped++
        continue
      }

      // Send notification
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      }

      const message = getRandomMessage()

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: message.title,
            body: message.body,
            tag: 'building-nick-scheduled',
            url: '/'
          })
        )
        results.sent++
        console.log(`[Send Notifications] Sent to ${sub.endpoint.substring(0, 50)}...`)
      } catch (e: unknown) {
        results.failed++
        console.error(`[Send Notifications] Failed for ${sub.endpoint.substring(0, 50)}:`, e)

        // If subscription is invalid/expired, remove it
        const error = e as { statusCode?: number }
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
          console.log('[Send Notifications] Removed expired subscription')
        }
      }
    }

    return NextResponse.json({
      message: 'Notifications processed',
      ...results
    })
  } catch (e) {
    console.error('[Send Notifications] Error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Debug/status endpoint and manual trigger
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const testMode = searchParams.get('test') === 'true'
  const forceMode = searchParams.get('force') === 'true'

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Get all subscriptions for debugging
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions', details: error }, { status: 500 })
  }

  const now = new Date()
  const debugInfo = {
    serverTime: now.toISOString(),
    serverHour: now.getHours(),
    serverMinute: now.getMinutes(),
    vapidConfigured: !!(vapidPublicKey && vapidPrivateKey),
    subscriptionCount: subscriptions?.length || 0,
    subscriptions: subscriptions?.map(sub => ({
      id: sub.id,
      timezone: sub.timezone,
      notification_times: sub.notification_times,
      endpoint: sub.endpoint?.substring(0, 50) + '...'
    }))
  }

  // If force mode, send notification to all subscribers regardless of time
  if (forceMode && subscriptions && subscriptions.length > 0) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ ...debugInfo, error: 'VAPID keys not configured' }, { status: 500 })
    }

    const results = { sent: 0, failed: 0, errors: [] as string[] }

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      }

      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: 'Test from server',
            body: `Forced notification at ${now.toLocaleTimeString()}`,
            tag: 'building-nick-test',
            url: '/'
          })
        )
        results.sent++
      } catch (e: unknown) {
        results.failed++
        const err = e as Error
        results.errors.push(err.message || String(e))
      }
    }

    return NextResponse.json({ ...debugInfo, forceResults: results })
  }

  // If test mode, run normal POST logic
  if (testMode) {
    return POST(request)
  }

  return NextResponse.json(debugInfo)
}
