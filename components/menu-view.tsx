'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, BarChart3, RefreshCw, Settings, ChevronRight, MapPin, Database, Calendar, Check, Sparkles, CheckCircle2, LogOut, Cloud, CloudOff, Loader2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWeather } from '@/hooks/use-weather'
import { useActivities } from '@/hooks/use-activities'
import { useCalendar } from '@/hooks/use-calendar'
import { useStorage, type TimeBlock } from '@/hooks/use-storage'
import { useAuth } from '@/hooks/use-auth'
import { useSync } from '@/hooks/use-sync'
import { LocationModal } from './location-modal'
import { CalendarSettingsModal } from './calendar-settings-modal'
import { HealthCoachModal } from './health-coach-modal'
import { MigrationModal } from './migration-modal'

interface MenuViewProps {
  onBack: () => void
  onOpenPlan: () => void
  onOpenPlanWithActivities?: (activityIds: string[]) => void
  onNavigateToToday?: () => void
  onShowToast?: (message: string) => void
}

interface MenuItem {
  icon: typeof CalendarDays
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
  connected?: boolean
}

export function MenuView({ onBack, onOpenPlan, onOpenPlanWithActivities, onNavigateToToday, onShowToast }: MenuViewProps) {
  const router = useRouter()
  const { locationName, hasLocation, updateLocation, resetLocation } = useWeather()
  const { source, lastSyncTime, isSyncing, syncFromNotion } = useActivities()
  const {
    isConnected: calendarConnected,
    email: calendarEmail,
    calendars,
    selectedCalendarIds,
    connect: connectCalendar,
    disconnect: disconnectCalendar,
    refetch: refetchCalendar,
    setSelectedCalendars
  } = useCalendar()
  const { user, isAuthenticated, isSupabaseEnabled, signInWithGoogle, signOut: signOutSupabase } = useAuth()
  const { syncStatus, lastSyncTime: cloudSyncTime, hasPendingMigration, pullFromCloud, migrateToCloud, dismissMigration } = useSync()
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [showHealthCoach, setShowHealthCoach] = useState(false)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const storage = useStorage()

  // Show migration modal when user just signed in and has local data
  const shouldShowMigrationPrompt = hasPendingMigration && isAuthenticated

  // Get next available time block based on current hour
  const getNextAvailableTimeBlock = (): TimeBlock => {
    const hour = new Date().getHours()
    if (hour < 6) return 'before6am'
    if (hour < 9) return 'before9am'
    if (hour < 12) return 'beforeNoon'
    if (hour < 14.5) return 'before230pm'
    if (hour < 17) return 'before5pm'
    return 'before9pm'
  }

  // Handle "Add to Today" from Health Coach
  const handleAddToToday = async (activityIds: string[]) => {
    if (activityIds.length === 0) return

    const today = new Date().toISOString().split('T')[0]
    const timeBlock = getNextAvailableTimeBlock()

    try {
      // Get existing schedule for today
      let schedule = await storage.getDailySchedule(today)

      if (!schedule) {
        schedule = {
          date: today,
          activities: {
            before6am: [],
            before9am: [],
            beforeNoon: [],
            before230pm: [],
            before5pm: [],
            before9pm: []
          }
        }
      }

      // Add activities to the time block (avoiding duplicates)
      const existingInBlock = schedule.activities[timeBlock] || []
      const newActivities = activityIds.filter(id => !existingInBlock.includes(id))

      if (newActivities.length > 0) {
        schedule.activities[timeBlock] = [...existingInBlock, ...newActivities]
        await storage.saveDailySchedule(schedule)
      }

      // Show toast and navigate
      setToast(`Added ${activityIds.length} activit${activityIds.length === 1 ? 'y' : 'ies'} to today's schedule`)
      setTimeout(() => setToast(null), 3000)

      // Navigate to Today view
      if (onNavigateToToday) {
        onNavigateToToday()
      }
    } catch (error) {
      console.error('Error adding activities to today:', error)
      setToast('Failed to add activities')
      setTimeout(() => setToast(null), 3000)
    }
  }

  // Handle "Focus for Week" from Health Coach
  const handleFocusForWeek = (activityIds: string[]) => {
    console.log('handleFocusForWeek called with:', activityIds, 'onShowToast:', !!onShowToast)
    // Show toast informing user to complete 7-day planning (use global toast for persistence)
    if (activityIds.length > 0 && onShowToast) {
      console.log('Calling onShowToast')
      onShowToast(`${activityIds.length} activit${activityIds.length === 1 ? 'y' : 'ies'} added — complete your 7-day plan`)
    }

    // Open planning view with pre-selected activities
    if (onOpenPlanWithActivities && activityIds.length > 0) {
      onOpenPlanWithActivities(activityIds)
    } else {
      onOpenPlan()
    }
  }

  // Format last sync time
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return 'Never synced'
    const date = new Date(isoString)
    return `Last synced ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const handleSyncNotion = async () => {
    const result = await syncFromNotion()
    if (result.success) {
      alert(`Synced ${result.count} activities from Notion!`)
    } else {
      alert(`Sync failed: ${result.message}`)
    }
  }

  const handleLogout = async () => {
    try {
      // Sign out from Supabase if authenticated
      if (isAuthenticated) {
        await signOutSupabase()
      }
      // Also sign out from legacy auth
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleCloudSync = async () => {
    if (!isAuthenticated) {
      await signInWithGoogle()
    } else {
      await pullFromCloud()
      setToast('Synced with cloud')
      setTimeout(() => setToast(null), 3000)
    }
  }

  // Get cloud sync status description
  const getCloudSyncDescription = () => {
    if (!isSupabaseEnabled) return 'Cloud sync not configured'
    if (!isAuthenticated) return 'Sign in to sync across devices'
    if (syncStatus === 'syncing') return 'Syncing...'
    if (syncStatus === 'error') return 'Sync error - tap to retry'
    if (cloudSyncTime) {
      return `Last synced ${cloudSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return 'Tap to sync'
  }

  // Get cloud sync icon
  const getCloudIcon = () => {
    if (!isAuthenticated) return Cloud
    if (syncStatus === 'syncing') return Loader2
    if (syncStatus === 'error') return CloudOff
    return Cloud
  }

  const menuItems: MenuItem[] = [
    {
      icon: CalendarDays,
      label: 'Plan Next 7 Days',
      description: 'Set your focus and schedule activities',
      onClick: onOpenPlan
    },
    {
      icon: Calendar,
      label: 'Google Calendar',
      description: calendarConnected
        ? `Connected as ${calendarEmail || 'Google Account'}`
        : 'Connect to see your events',
      onClick: calendarConnected ? () => setShowCalendarModal(true) : connectCalendar,
      connected: calendarConnected
    },
    {
      icon: Sparkles,
      label: 'Health Coach',
      description: 'Get personalized activity suggestions',
      onClick: () => setShowHealthCoach(true)
    },
    {
      icon: MapPin,
      label: 'Weather Location',
      description: locationName || (hasLocation ? 'Using device location' : 'Set your location for weather'),
      onClick: () => setShowLocationModal(true)
    },
    {
      icon: Database,
      label: 'Sync from Notion',
      description: source === 'notion' ? formatSyncTime(lastSyncTime) : (source === 'cached' ? formatSyncTime(lastSyncTime) : 'Using local activities'),
      onClick: handleSyncNotion,
      disabled: isSyncing
    },
    {
      icon: getCloudIcon(),
      label: isAuthenticated ? 'Cloud Sync' : 'Sign In',
      description: getCloudSyncDescription(),
      onClick: handleCloudSync,
      connected: isAuthenticated,
      disabled: !isSupabaseEnabled
    },
    {
      icon: BarChart3,
      label: 'Statistics',
      description: 'View your progress and streaks',
      onClick: () => {},
      disabled: true
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Notifications, preferences',
      onClick: () => {},
      disabled: true
    },
    {
      icon: LogOut,
      label: 'Sign Out',
      description: 'Log out of your account',
      onClick: handleLogout
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">More</h2>
        {isAuthenticated && user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="truncate max-w-[150px]">{user.email}</span>
          </div>
        )}
      </div>

      {/* Migration Banner */}
      {shouldShowMigrationPrompt && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">Sync your data to the cloud</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                We found local data on this device. Would you like to sync it to your account?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowMigrationModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Sync Now
                </button>
                <button
                  onClick={dismissMigration}
                  className="px-3 py-1.5 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              'w-full flex items-center gap-4 rounded-xl border bg-card p-4 transition-all text-left',
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-muted-foreground/30 hover:shadow-md'
            )}
          >
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary",
              syncStatus === 'syncing' && item.label === 'Cloud Sync' && 'animate-pulse'
            )}>
              <item.icon className={cn(
                "h-5 w-5",
                syncStatus === 'syncing' && item.label === 'Cloud Sync' && 'animate-spin'
              )} />
            </div>
            <div className="flex-1">
              <span className="font-medium text-foreground">{item.label}</span>
              <p className="text-sm text-muted-foreground mt-0.5">
                {item.description}
              </p>
            </div>
            {item.connected ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Coming Soon Note */}
      <p className="text-xs text-center text-muted-foreground">
        Statistics and Settings coming soon in future updates.
      </p>

      {/* Location Modal */}
      {showLocationModal && (
        <LocationModal
          currentLocation={locationName}
          onClose={() => setShowLocationModal(false)}
          onUpdateLocation={updateLocation}
          onResetLocation={resetLocation}
        />
      )}

      {/* Calendar Settings Modal */}
      {showCalendarModal && (
        <CalendarSettingsModal
          email={calendarEmail}
          calendars={calendars}
          selectedCalendarIds={selectedCalendarIds}
          onClose={() => setShowCalendarModal(false)}
          onDisconnect={disconnectCalendar}
          onRefresh={refetchCalendar}
          onSetSelectedCalendars={setSelectedCalendars}
        />
      )}

      {/* Health Coach Modal */}
      {showHealthCoach && (
        <HealthCoachModal
          onClose={() => setShowHealthCoach(false)}
          onAcceptSuggestion={() => {}}
          onAddToToday={(activityIds) => {
            setShowHealthCoach(false)
            handleAddToToday(activityIds)
          }}
          onFocusForWeek={(activityIds) => {
            setShowHealthCoach(false)
            handleFocusForWeek(activityIds)
          }}
        />
      )}

      {/* Migration Modal */}
      {showMigrationModal && (
        <MigrationModal
          onClose={() => setShowMigrationModal(false)}
          onMigrate={async () => {
            const result = await migrateToCloud()
            if (result.success) {
              setShowMigrationModal(false)
              setToast('Data synced to cloud successfully!')
              setTimeout(() => setToast(null), 3000)
            }
            return result
          }}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 text-white rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 z-50">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  )
}
