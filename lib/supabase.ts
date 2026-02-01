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

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return null if Supabase is not configured (app works without it)
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return browserClient
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
