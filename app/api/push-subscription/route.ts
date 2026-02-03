import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const defaultUserId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'default-user'

// GET - Debug info and clear all option
export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const clearAll = searchParams.get('clear') === 'all'

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  if (clearAll) {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      return NextResponse.json({ error: 'Failed to clear', details: error }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'All subscriptions cleared' })
  }

  // Return current subscriptions
  const { data, error } = await supabase.from('push_subscriptions').select('*')
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch', details: error }, { status: 500 })
  }

  return NextResponse.json({
    count: data?.length || 0,
    subscriptions: data?.map(s => ({
      id: s.id,
      endpoint: s.endpoint?.substring(0, 50) + '...',
      timezone: s.timezone,
      times: s.notification_times
    }))
  })
}

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { subscription, notificationTimes, timezone } = body

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Extract keys from subscription
    const keys = subscription.keys || {}

    // Upsert the subscription (update if endpoint exists, insert if new)
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: defaultUserId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh || '',
          auth: keys.auth || '',
          notification_times: notificationTimes || [],
          timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        {
          onConflict: 'endpoint'
        }
      )
      .select()

    if (error) {
      console.error('[Push API] Error saving subscription:', error)
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      )
    }

    console.log('[Push API] Subscription saved:', data)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[Push API] Error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update notification times
export async function PUT(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    const { endpoint, notificationTimes } = body

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase
      .from('push_subscriptions')
      .update({ notification_times: notificationTimes || [] })
      .eq('endpoint', endpoint)
      .select()

    if (error) {
      console.error('[Push API] Error updating subscription:', error)
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[Push API] Error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const clearAll = searchParams.get('all') === 'true'

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    if (clearAll) {
      // Clear all subscriptions (for debugging)
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

      if (error) {
        console.error('[Push API] Error clearing all subscriptions:', error)
        return NextResponse.json(
          { error: 'Failed to clear subscriptions' },
          { status: 500 }
        )
      }

      console.log('[Push API] All subscriptions cleared')
      return NextResponse.json({ success: true, message: 'All subscriptions cleared' })
    }

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)

    if (error) {
      console.error('[Push API] Error deleting subscription:', error)
      return NextResponse.json(
        { error: 'Failed to delete subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Push API] Error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
