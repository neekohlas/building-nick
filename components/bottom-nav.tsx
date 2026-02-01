'use client'

import { Calendar, CalendarDays, Library, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export type View = 'today' | 'week' | 'library' | 'menu'

interface BottomNavProps {
  activeView: View
  onViewChange: (view: View) => void
}

const NAV_ITEMS: { view: View; label: string; icon: typeof Calendar }[] = [
  { view: 'today', label: 'Today', icon: Calendar },
  { view: 'week', label: 'Week', icon: CalendarDays },
  { view: 'library', label: 'Library', icon: Library },
  { view: 'menu', label: 'More', icon: Menu }
]

export function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex justify-around px-4 py-2">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors',
              activeView === view
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
