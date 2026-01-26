'use client'

import { CalendarDays, BarChart3, RefreshCw, Settings, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MenuViewProps {
  onBack: () => void
  onOpenPlan: () => void
}

interface MenuItem {
  icon: typeof CalendarDays
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
}

export function MenuView({ onBack, onOpenPlan }: MenuViewProps) {
  const menuItems: MenuItem[] = [
    {
      icon: CalendarDays,
      label: 'Plan Next 7 Days',
      description: 'Set your focus and schedule activities',
      onClick: onOpenPlan
    },
    {
      icon: BarChart3,
      label: 'Statistics',
      description: 'View your progress and streaks',
      onClick: () => {},
      disabled: true
    },
    {
      icon: RefreshCw,
      label: 'Sync Data',
      description: 'Sync your progress across devices',
      onClick: () => {},
      disabled: true
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Notifications, preferences',
      onClick: () => {},
      disabled: true
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">More</h2>
      </div>

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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-foreground">{item.label}</span>
              <p className="text-sm text-muted-foreground mt-0.5">
                {item.description}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Coming Soon Note */}
      <p className="text-xs text-center text-muted-foreground">
        Statistics, Sync, and Settings coming soon in future updates.
      </p>
    </div>
  )
}
