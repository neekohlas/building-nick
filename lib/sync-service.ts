import { getSupabaseBrowserClient, DbCompletion, DbSchedule, DbSavedPlanConfig } from './supabase'
import { Completion, DailySchedule, SavedPlanConfig } from '@/hooks/use-storage'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

interface SyncResult {
  success: boolean
  error?: string
  counts?: {
    completions: number
    schedules: number
    planConfigs: number
  }
}

// Convert local types to database types
function completionToDb(completion: Completion, userId: string): Omit<DbCompletion, 'updated_at'> {
  return {
    id: completion.id,
    user_id: userId,
    date: completion.date,
    activity_id: completion.activityId,
    time_block: completion.timeBlock,
    instance_index: completion.instanceIndex,
    completed_at: completion.completedAt,
  }
}

function dbToCompletion(db: DbCompletion): Completion {
  return {
    id: db.id,
    date: db.date,
    activityId: db.activity_id,
    timeBlock: db.time_block,
    instanceIndex: db.instance_index ?? 0,  // Default to 0 for legacy completions
    completedAt: db.completed_at,
  }
}

function scheduleToDb(schedule: DailySchedule, userId: string): Omit<DbSchedule, 'updated_at'> {
  return {
    date: schedule.date,
    user_id: userId,
    activities: schedule.activities,
  }
}

function dbToSchedule(db: DbSchedule): DailySchedule {
  return {
    date: db.date,
    activities: db.activities,
  }
}

function planConfigToDb(config: SavedPlanConfig, userId: string): Omit<DbSavedPlanConfig, 'updated_at'> {
  return {
    id: config.id,
    user_id: userId,
    saved_at: config.savedAt,
    name: config.name || null,
    starred: config.starred || false,
    is_auto_saved: config.isAutoSaved || false,
    selected_activities: config.selectedActivities,
    frequencies: config.frequencies,
    custom_days: config.customDays || {},
    heavy_day_schedule: config.heavyDaySchedule,
    light_day_schedule: config.lightDaySchedule,
    start_with_heavy: config.startWithHeavy,
  }
}

function dbToPlanConfig(db: DbSavedPlanConfig): SavedPlanConfig {
  return {
    id: db.id,
    savedAt: db.saved_at,
    name: db.name || undefined,
    starred: db.starred || false,
    isAutoSaved: db.is_auto_saved || false,
    selectedActivities: db.selected_activities,
    frequencies: db.frequencies,
    customDays: db.custom_days || {},
    heavyDaySchedule: db.heavy_day_schedule,
    lightDaySchedule: db.light_day_schedule,
    startWithHeavy: db.start_with_heavy,
  }
}

// Sync a single completion to Supabase
export async function syncCompletion(completion: Completion, userId: string): Promise<boolean> {
  console.log('[syncService] syncCompletion called:', { completionId: completion.id, userId: userId.substring(0, 8) + '...' })
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.log('[syncService] No Supabase client available')
    return false
  }

  try {
    const dbData = completionToDb(completion, userId)
    console.log('[syncService] Upserting completion:', dbData)
    const { error } = await supabase
      .from('completions')
      .upsert(dbData, {
        onConflict: 'user_id,id',
      })

    if (error) {
      console.error('[syncService] Error syncing completion:', error)
      return false
    }
    console.log('[syncService] Completion synced successfully')
    return true
  } catch (e) {
    console.error('[syncService] Exception syncing completion:', e)
    return false
  }
}

// Remove a completion from Supabase
export async function removeCompletionFromCloud(completionId: string, userId: string): Promise<boolean> {
  console.log('[syncService] removeCompletionFromCloud called:', { completionId, userId: userId.substring(0, 8) + '...' })
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.log('[syncService] No Supabase client available')
    return false
  }

  try {
    const { error } = await supabase
      .from('completions')
      .delete()
      .eq('user_id', userId)
      .eq('id', completionId)

    if (error) {
      console.error('[syncService] Error removing completion:', error)
      return false
    }
    console.log('[syncService] Completion removed successfully')
    return true
  } catch (e) {
    console.error('[syncService] Exception removing completion:', e)
    return false
  }
}

// Sync a single schedule to Supabase
export async function syncSchedule(schedule: DailySchedule, userId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return false

  try {
    const { error } = await supabase
      .from('schedules')
      .upsert(scheduleToDb(schedule, userId), {
        onConflict: 'user_id,date',
      })

    if (error) {
      console.error('Error syncing schedule:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('Exception syncing schedule:', e)
    return false
  }
}

// Sync plan config to Supabase (works for both 'latest' and named routines)
export async function syncPlanConfig(config: SavedPlanConfig, userId: string): Promise<boolean> {
  console.log('[syncService] syncPlanConfig called:', { configId: config.id, name: config.name, userId: userId.substring(0, 8) + '...' })
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.log('[syncService] No Supabase client available')
    return false
  }

  try {
    const dbData = planConfigToDb(config, userId)
    console.log('[syncService] Upserting plan config:', { id: dbData.id, name: dbData.name, starred: dbData.starred })
    const { error } = await supabase
      .from('saved_plan_configs')
      .upsert(dbData, {
        onConflict: 'user_id,id',
      })

    if (error) {
      console.error('[syncService] Error syncing plan config:', error)
      return false
    }
    console.log('[syncService] Plan config synced successfully')
    return true
  } catch (e) {
    console.error('[syncService] Exception syncing plan config:', e)
    return false
  }
}

// Delete a routine from Supabase
export async function deleteRoutineFromCloud(routineId: string, userId: string): Promise<boolean> {
  console.log('[syncService] deleteRoutineFromCloud called:', { routineId, userId: userId.substring(0, 8) + '...' })
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    console.log('[syncService] No Supabase client available')
    return false
  }

  try {
    const { error } = await supabase
      .from('saved_plan_configs')
      .delete()
      .eq('user_id', userId)
      .eq('id', routineId)

    if (error) {
      console.error('[syncService] Error deleting routine:', error)
      return false
    }
    console.log('[syncService] Routine deleted successfully')
    return true
  } catch (e) {
    console.error('[syncService] Exception deleting routine:', e)
    return false
  }
}

// Pull all data from Supabase for a user
export async function pullAllFromCloud(userId: string): Promise<{
  completions: Completion[]
  schedules: DailySchedule[]
  planConfigs: SavedPlanConfig[]
} | null> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return null

  try {
    const [completionsRes, schedulesRes, configsRes] = await Promise.all([
      supabase.from('completions').select('*').eq('user_id', userId),
      supabase.from('schedules').select('*').eq('user_id', userId),
      supabase.from('saved_plan_configs').select('*').eq('user_id', userId),
    ])

    if (completionsRes.error) console.error('Error fetching completions:', completionsRes.error)
    if (schedulesRes.error) console.error('Error fetching schedules:', schedulesRes.error)
    if (configsRes.error) console.error('Error fetching configs:', configsRes.error)

    return {
      completions: (completionsRes.data || []).map(dbToCompletion),
      schedules: (schedulesRes.data || []).map(dbToSchedule),
      planConfigs: (configsRes.data || []).map(dbToPlanConfig),
    }
  } catch (e) {
    console.error('Exception pulling from cloud:', e)
    return null
  }
}

// Push all local data to Supabase (for migration)
export async function pushAllToCloud(
  userId: string,
  data: {
    completions: Completion[]
    schedules: DailySchedule[]
    planConfig: SavedPlanConfig | null
  }
): Promise<SyncResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { success: false, error: 'Supabase not configured' }

  try {
    let completionsCount = 0
    let schedulesCount = 0
    let planConfigsCount = 0

    // Push completions in batches
    if (data.completions.length > 0) {
      const dbCompletions = data.completions.map(c => completionToDb(c, userId))
      const { error } = await supabase
        .from('completions')
        .upsert(dbCompletions, { onConflict: 'user_id,id' })

      if (error) {
        console.error('Error pushing completions:', error)
      } else {
        completionsCount = data.completions.length
      }
    }

    // Push schedules in batches
    if (data.schedules.length > 0) {
      const dbSchedules = data.schedules.map(s => scheduleToDb(s, userId))
      const { error } = await supabase
        .from('schedules')
        .upsert(dbSchedules, { onConflict: 'user_id,date' })

      if (error) {
        console.error('Error pushing schedules:', error)
      } else {
        schedulesCount = data.schedules.length
      }
    }

    // Push plan config
    if (data.planConfig) {
      const dbConfig = planConfigToDb(data.planConfig, userId)
      const { error } = await supabase
        .from('saved_plan_configs')
        .upsert(dbConfig, { onConflict: 'user_id,id' })

      if (error) {
        console.error('Error pushing plan config:', error)
      } else {
        planConfigsCount = 1
      }
    }

    return {
      success: true,
      counts: {
        completions: completionsCount,
        schedules: schedulesCount,
        planConfigs: planConfigsCount,
      },
    }
  } catch (e) {
    console.error('Exception pushing to cloud:', e)
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Check if user has any data in the cloud
export async function hasCloudData(userId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return false

  try {
    const { count, error } = await supabase
      .from('completions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      console.error('Error checking cloud data:', error)
      return false
    }

    return (count || 0) > 0
  } catch (e) {
    console.error('Exception checking cloud data:', e)
    return false
  }
}
