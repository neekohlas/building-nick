'use client'

import { X, Clock } from 'lucide-react'
import { Activity, ACTIVITIES, CATEGORIES } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

interface SwapModalProps {
  currentActivity: Activity
  onClose: () => void
  onSwap: (newActivityId: string) => void
}

export function SwapModal({ currentActivity, onClose, onSwap }: SwapModalProps) {
  // Get activities in the same category
  const alternatives = Object.values(ACTIVITIES).filter(
    a => a.category === currentActivity.category && a.id !== currentActivity.id
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4">
          <div>
            <h2 className="text-lg font-semibold">Swap Activity</h2>
            <p className="text-sm text-muted-foreground">
              Replace "{currentActivity.name}" with:
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2 pb-[env(safe-area-inset-bottom)]">
          {alternatives.map((activity) => {
            const category = CATEGORIES[activity.category]
            return (
              <button
                key={activity.id}
                onClick={() => onSwap(activity.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all',
                  'hover:border-primary hover:bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activity.name}</span>
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(activity.duration)}
                </div>
              </button>
            )
          })}

          {alternatives.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No alternative activities available in this category.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
