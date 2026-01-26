'use client'

import { CalendarClock as CalendarArrowUp, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Activity } from '@/lib/activities'

interface PushModalProps {
  activity?: Activity | null
  incompleteCount: number
  onClose: () => void
  onPushSingle: () => void
  onPushAllIncomplete: () => void
}

export function PushModal({
  activity,
  incompleteCount,
  onClose,
  onPushSingle,
  onPushAllIncomplete
}: PushModalProps) {
  const showBulkOption = incompleteCount > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-card animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 border-b p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CalendarArrowUp className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Push to Tomorrow</h2>
          <p className="text-sm text-muted-foreground">
            {activity 
              ? `Move "${activity.name}" to tomorrow's schedule?`
              : "Which activities would you like to move to tomorrow?"
            }
          </p>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2 pb-[env(safe-area-inset-bottom)]">
          {activity && (
            <button
              onClick={onPushSingle}
              className="w-full flex items-center justify-between rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted"
            >
              <div>
                <div className="font-medium">Push this activity only</div>
                <div className="text-sm text-muted-foreground">
                  Move "{activity.name}" to tomorrow
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}

          {showBulkOption && (
            <button
              onClick={onPushAllIncomplete}
              className="w-full flex items-center justify-between rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted"
            >
              <div>
                <div className="font-medium">Push all incomplete</div>
                <div className="text-sm text-muted-foreground">
                  Move {incompleteCount} activities to tomorrow
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          )}

          <Button
            variant="outline"
            className="w-full mt-2 bg-transparent"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
