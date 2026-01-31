'use client'

import { useState } from 'react'
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
  const today = new Date()
  const { hasConnectionError, retryConnection, clearDatabase } = useStorage()

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Database Recovery Modal */}
      {hasConnectionError && (
        <DatabaseRecovery
          onRetry={retryConnection}
          onClear={clearDatabase}
        />
      )}
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-blue-500 text-primary-foreground px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Building Nick</h1>
            <p className="text-sm opacity-90 mt-1">{formatDateFriendly(today)}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm">
            <span>--</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
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
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeView={activeView as View} onViewChange={setActiveView} />
    </div>
  )
}
