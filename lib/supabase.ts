import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

// Database types
export interface DbCompletion {
  id: string
  user_id: string
  date: string
  activity_id: string
  time_block: string
  completed_at: string
  updated_at: string
}

export interface DbSchedule {
  date: string
  user_id: string
  activities: {
    before6am: string[]
    before9am: string[]
    beforeNoon: string[]
    before230pm: string[]
    before5pm: string[]
    before9pm: string[]
  }
  updated_at: string
}

export interface DbSavedPlanConfig {
  id: string
  user_id: string
  saved_at: string
  selected_activities: string[]
  frequencies: Record<string, 'everyday' | 'heavy' | 'light' | 'weekdays' | 'weekends'>
  heavy_day_schedule: DbSchedule['activities']
  light_day_schedule: DbSchedule['activities']
  start_with_heavy: boolean
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      completions: {
        Row: DbCompletion
        Insert: Omit<DbCompletion, 'updated_at'>
        Update: Partial<DbCompletion>
      }
      schedules: {
        Row: DbSchedule
        Insert: Omit<DbSchedule, 'updated_at'>
        Update: Partial<DbSchedule>
      }
      saved_plan_configs: {
        Row: DbSavedPlanConfig
        Insert: Omit<DbSavedPlanConfig, 'updated_at'>
        Update: Partial<DbSavedPlanConfig>
      }
    }
  }
}

// Singleton browser client
let browserClient: SupabaseClient<Database> | null = null
let hasLoggedConfigStatus = false

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Log configuration status once
  if (!hasLoggedConfigStatus) {
    hasLoggedConfigStatus = true
    console.log('[Supabase] Configuration check:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasDefaultUserId: !!process.env.NEXT_PUBLIC_DEFAULT_USER_ID,
      url: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET',
    })
  }

  // Return null if Supabase is not configured (app works without it)
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
    console.log('[Supabase] Browser client initialized')
  }

  return browserClient
}

// Check if Supabase is configured (including default user ID for single-user mode)
export function isSupabaseConfigured(): boolean {
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_DEFAULT_USER_ID
  )

  if (typeof window !== 'undefined') {
    console.log('[Supabase] isSupabaseConfigured:', configured, {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasDefaultUserId: !!process.env.NEXT_PUBLIC_DEFAULT_USER_ID,
      defaultUserId: process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'NOT SET',
    })
  }

  return configured
}
