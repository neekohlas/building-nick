'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { TodayView } from '@/components/today-view'
import { WeekView } from '@/components/week-view'
import { PlanWeekView } from '@/components/plan-week-view'
import { LibraryView } from '@/components/library-view'
import { MenuView } from '@/components/menu-view'
import { BottomNav, View } from '@/components/bottom-nav'
import { DatabaseRecovery } from '@/components/database-recovery'
import { useStorage } from '@/hooks/use-storage'
import { formatDateFriendly } from '@/lib/date-utils'

export default function Home() {
  const [activeView, setActiveView] = useState<View | 'plan'>('today')
  const [preSelectedActivities, setPreSelectedActivities] = useState<string[]>([])
  const [globalToast, setGlobalToast] = useState<string | null>(null)
  const today = new Date()
  const { hasConnectionError, retryConnection, clearDatabase } = useStorage()

  // Auto-dismiss toast
  useEffect(() => {
    if (globalToast) {
      console.log('Global toast set to:', globalToast)
      const timer = setTimeout(() => setGlobalToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [globalToast])

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Database Recovery Modal */}
      {hasConnectionError && (
        <DatabaseRecovery
          onRetry={retryConnection}
          onClear={clearDatabase}
        />
      )}

      {/* Desktop max-width container (like Wordle) */}
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <header className="bg-gradient-to-br from-primary to-blue-500 text-primary-foreground px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
          <h1 className="text-xl font-bold tracking-tight">Building Nick</h1>
          <p className="text-sm opacity-90">{formatDateFriendly(today)}</p>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 pt-4 pb-6">
        {activeView === 'today' && (
          <TodayView onOpenMenu={() => setActiveView('menu')} />
        )}
        {activeView === 'week' && (
          <WeekView onBack={() => setActiveView('today')} />
        )}
        {activeView === 'plan' && (
          <PlanWeekView
            onComplete={() => {
              setActiveView('today')
              setPreSelectedActivities([])
            }}
            onBack={() => {
              setActiveView('menu')
              setPreSelectedActivities([])
            }}
            preSelectedActivities={preSelectedActivities}
          />
        )}
        {activeView === 'library' && (
          <LibraryView onBack={() => setActiveView('today')} />
        )}
        {activeView === 'menu' && (
          <MenuView
            onBack={() => setActiveView('today')}
            onOpenPlan={() => setActiveView('plan')}
            onOpenPlanWithActivities={(activityIds) => {
              setPreSelectedActivities(activityIds)
              setActiveView('plan')
            }}
            onNavigateToToday={() => setActiveView('today')}
            onShowToast={setGlobalToast}
          />
        )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav activeView={activeView as View} onViewChange={setActiveView} />
      </div>

      {/* Global Toast - persists across view changes */}
      {globalToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 text-white rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 z-50">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">{globalToast}</span>
        </div>
      )}
    </div>
  )
}
