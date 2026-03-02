import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { ACTIVITIES } from '@/lib/activities'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const defaultUserId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'default-user'

// Configure web-push
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:notifications@building-nick.app',
    vapidPublicKey,
    vapidPrivateKey
  )
}

// Time block definitions (hour boundaries)
const TIME_BLOCKS = [
  { id: 'before6am', startHour: 0, endHour: 6, label: 'Early Morning' },
  { id: 'before9am', startHour: 6, endHour: 9, label: 'Morning' },
  { id: 'beforeNoon', startHour: 9, endHour: 12, label: 'Late Morning' },
  { id: 'before230pm', startHour: 12, endHour: 14.5, label: 'Early Afternoon' },
  { id: 'before5pm', startHour: 14.5, endHour: 17, label: 'Afternoon' },
  { id: 'before9pm', startHour: 17, endHour: 21, label: 'Evening' },
]

function getCurrentTimeBlock(hour: number): string {
  const hourDecimal = hour
  for (const block of TIME_BLOCKS) {
    if (hourDecimal >= block.startHour && hourDecimal < block.endHour) {
      return block.id
    }
  }
  return 'before9pm' // Default to evening for late night
}

function getNextTimeBlocks(currentBlockId: string): string[] {
  const currentIndex = TIME_BLOCKS.findIndex(b => b.id === currentBlockId)
  if (currentIndex === -1) return []
  return TIME_BLOCKS.slice(currentIndex + 1).map(b => b.id)
}

// Celebration messages for completed items
const CELEBRATION_MESSAGES = [
  "Nice work on {items}!",
  "Crushed it: {items}!",
  "{items} ✓ – way to show up!",
  "Done: {items}. You're building momentum!",
  "{items} complete! Keep it rolling.",
]

// Encouragement for pending items
const ENCOURAGEMENT_MESSAGES = [
  "Still on deck: {items}",
  "Don't forget: {items}",
  "Waiting for you: {items}",
  "You've got {items} left",
]

// Look ahead messages
const LOOK_AHEAD_MESSAGES = [
  "Coming up: {items}",
  "Next: {items}",
  "On deck for later: {items}",
]

// Full completion messages
const ALL_DONE_MESSAGES = [
  "You crushed it today! Everything's done. 🎉",
  "All done for today! You showed up and delivered.",
  "100% complete! Take a moment to appreciate that.",
  "Everything checked off. That's how it's done!",
  "All activities complete! You're building something real.",
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatActivityList(activities: string[], max: number = 3): string {
  if (activities.length === 0) return ''
  if (activities.length <= max) {
    return activities.join(', ')
  }
  return `${activities.slice(0, max).join(', ')} +${activities.length - max} more`
}

interface NotificationContent {
  title: string
  body: string
}

async function buildSmartNotification(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  currentHour: number
): Promise<NotificationContent> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD format

  // Fetch today's schedule
  const { data: scheduleData } = await supabase
    .from('schedules')
    .select('activities')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  // Fetch today's completions
  const { data: completionsData } = await supabase
    .from('completions')
    .select('activity_id, time_block, instance_index')
    .eq('user_id', userId)
    .eq('date', today)

  // Fetch today's reminders (incomplete)
  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`
  const { data: remindersData } = await supabase
    .from('reminders')
    .select('title, is_completed, due_date')
    .eq('user_id', userId)
    .gte('due_date', startOfDay)
    .lte('due_date', endOfDay)

  // Get activity names from hardcoded definitions
  const activityNames: Record<string, string> = {}
  for (const [id, activity] of Object.entries(ACTIVITIES)) {
    activityNames[id] = activity.name
  }

  // Parse schedule
  const schedule = scheduleData?.activities as Record<string, string[]> | undefined
  if (!schedule) {
    // No schedule for today - simple message
    return {
      title: "Time to check in!",
      body: "No activities scheduled, but maybe plan something?"
    }
  }

  // Build completion set for quick lookup
  const completionSet = new Set<string>()
  if (completionsData) {
    for (const c of completionsData) {
      // Key format: timeBlock_activityId_instanceIndex
      completionSet.add(`${c.time_block}_${c.activity_id}_${c.instance_index}`)
    }
  }

  // Get current time block and analyze
  const currentBlock = getCurrentTimeBlock(currentHour)
  const nextBlocks = getNextTimeBlocks(currentBlock)

  // Count activities by status
  let totalActivities = 0
  let completedCount = 0
  const pendingActivities: string[] = []
  const upcomingActivities: string[] = []
  const recentlyCompleted: string[] = []

  // Blocks that are "past" (before current block)
  const pastBlocks = TIME_BLOCKS.slice(0, TIME_BLOCKS.findIndex(b => b.id === currentBlock) + 1).map(b => b.id)

  for (const [blockId, activities] of Object.entries(schedule)) {
    for (let i = 0; i < activities.length; i++) {
      const activityId = activities[i]
      const key = `${blockId}_${activityId}_${i}`
      const name = activityNames[activityId] || activityId

      totalActivities++

      if (completionSet.has(key)) {
        completedCount++
        // Only show recently completed (current block or just before)
        if (blockId === currentBlock || blockId === pastBlocks[pastBlocks.length - 2]) {
          recentlyCompleted.push(name)
        }
      } else if (pastBlocks.includes(blockId)) {
        // Past or current block, not completed = pending
        pendingActivities.push(name)
      } else {
        // Future block = upcoming
        upcomingActivities.push(name)
      }
    }
  }

  // Add incomplete reminders to pending
  if (remindersData) {
    for (const r of remindersData) {
      if (!r.is_completed) {
        const reminderHour = new Date(r.due_date).getHours()
        if (reminderHour <= currentHour) {
          pendingActivities.push(r.title)
        } else {
          upcomingActivities.push(r.title)
        }
      }
    }
  }

  // Build notification based on status
  if (completedCount === totalActivities && totalActivities > 0) {
    // ALL DONE!
    return {
      title: "All done! 🎉",
      body: pickRandom(ALL_DONE_MESSAGES)
    }
  }

  // Build multi-part message
  const parts: string[] = []

  // Celebrate recent completions (limit to 2)
  if (recentlyCompleted.length > 0) {
    const template = pickRandom(CELEBRATION_MESSAGES)
    parts.push(template.replace('{items}', formatActivityList(recentlyCompleted, 2)))
  }

  // Encourage for pending items
  if (pendingActivities.length > 0) {
    const template = pickRandom(ENCOURAGEMENT_MESSAGES)
    parts.push(template.replace('{items}', formatActivityList(pendingActivities, 2)))
  } else if (upcomingActivities.length > 0) {
    // Nothing pending, look ahead
    const template = pickRandom(LOOK_AHEAD_MESSAGES)
    parts.push(template.replace('{items}', formatActivityList(upcomingActivities, 2)))
  }

  if (parts.length === 0) {
    // Fallback
    return {
      title: "Time to check in!",
      body: "See what's on your schedule today."
    }
  }

  // Build title based on context
  let title = "Check in"
  if (recentlyCompleted.length > 0 && pendingActivities.length > 0) {
    title = "Good progress!"
  } else if (recentlyCompleted.length > 0) {
    title = "Nice work!"
  } else if (pendingActivities.length > 0) {
    title = "Time to check in"
  } else if (upcomingActivities.length > 0) {
    title = "Looking ahead"
  }

  return {
    title,
    body: parts.join(' ')
  }
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
      const timezone = sub.timezone || 'America/Los_Angeles'

      try {
        const timeInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
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

      // Build smart notification content
      const message = await buildSmartNotification(
        supabase,
        sub.user_id || defaultUserId,
        timezone,
        subscriberHour
      )

      // Send notification
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      }

      try {
        const payload = JSON.stringify({
          title: message.title,
          body: message.body,
          tag: 'building-nick-scheduled',
          url: '/'
        })

        // Web push options - don't set topic for iOS web push (Apple rejects invalid topics)
        const options = {
          TTL: 60, // 60 seconds
          urgency: 'high' as const
        }

        await webpush.sendNotification(pushSubscription, payload, options)
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

  // If force mode, send smart notification to all subscribers
  if (forceMode && subscriptions && subscriptions.length > 0) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ ...debugInfo, error: 'VAPID keys not configured' }, { status: 500 })
    }

    const results = { sent: 0, failed: 0, errors: [] as string[], messages: [] as { title: string; body: string }[] }

    for (const sub of subscriptions) {
      const timezone = sub.timezone || 'America/Los_Angeles'
      let currentHour: number
      try {
        const timeInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
        currentHour = timeInTz.getHours()
      } catch {
        currentHour = now.getUTCHours()
      }

      // Build smart notification
      const message = await buildSmartNotification(
        supabase,
        sub.user_id || defaultUserId,
        timezone,
        currentHour
      )
      results.messages.push(message)

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      }

      try {
        const payload = JSON.stringify({
          title: message.title,
          body: message.body,
          tag: 'building-nick-test',
          url: '/'
        })

        // Web push options - don't set topic for iOS web push (Apple rejects invalid topics)
        const options = {
          TTL: 60, // 60 seconds
          urgency: 'high' as const
        }

        await webpush.sendNotification(pushSubscription, payload, options)
        results.sent++
      } catch (e: unknown) {
        results.failed++
        const err = e as { message?: string; statusCode?: number; body?: string; headers?: Record<string, string> }
        // Include the response body from Apple - this contains the actual error reason
        const errorMsg = `${err.statusCode || 'no-code'}: ${err.body || err.message || String(e)}`
        results.errors.push(errorMsg)
        console.error('[Send Notifications] Force push error:', JSON.stringify(err, null, 2))
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
