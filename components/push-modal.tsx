'use client'

import { useState, useEffect } from 'react'
import { CalendarClock as CalendarArrowUp, ChevronRight, ChevronDown, ChevronUp, Calendar, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Activity } from '@/lib/activities'
import { useStorage, DailySchedule, TimeBlock } from '@/hooks/use-storage'
import { cn } from '@/lib/utils'

export interface FutureOccurrence {
  date: string
  dateLabel: string
  timeBlock: TimeBlock
  shouldPush: boolean // User's choice: push or keep
}

interface PushModalProps {
  activity?: Activity | null
  incompleteCount: number
  currentDate: string // The date we're pushing FROM
  onClose: () => void
  onPushSingle: (futurePushes: FutureOccurrence[]) => void
  onPushAllIncomplete: () => void
}

// Format date for display (e.g., "Wed, Feb 5")
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Get day difference label
function getDayDiff(fromDate: string, toDate: string): string {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'tomorrow'
  if (diffDays === 2) return 'in 2 days'
  if (diffDays < 7) return `in ${diffDays} days`
  if (diffDays === 7) return 'in 1 week'
  return `in ${diffDays} days`
}

export function PushModal({
  activity,
  incompleteCount,
  currentDate,
  onClose,
  onPushSingle,
  onPushAllIncomplete
}: PushModalProps) {
  const storage = useStorage()
  const showBulkOption = incompleteCount > 1

  // Future occurrences state
  const [futureOccurrences, setFutureOccurrences] = useState<FutureOccurrence[]>([])
  const [isLoadingFuture, setIsLoadingFuture] = useState(false)
  const [showFutureSection, setShowFutureSection] = useState(true)

  // Load future occurrences when modal opens
  useEffect(() => {
    if (!activity || !storage.isReady) return

    const loadFutureOccurrences = async () => {
      setIsLoadingFuture(true)

      try {
        // Look ahead 30 days for same activity
        const occurrences: FutureOccurrence[] = []
        const startDate = new Date(currentDate)

        for (let i = 1; i <= 30; i++) {
          const checkDate = new Date(startDate)
          checkDate.setDate(checkDate.getDate() + i)
          const dateStr = checkDate.toISOString().split('T')[0]

          const schedule = await storage.getDailySchedule(dateStr)
          if (!schedule) continue

          // Check all time blocks for this activity
          for (const block of Object.keys(schedule.activities) as TimeBlock[]) {
            if (schedule.activities[block].includes(activity.id)) {
              occurrences.push({
                date: dateStr,
                dateLabel: formatDateLabel(dateStr),
                timeBlock: block,
                shouldPush: true // Default: push all future occurrences
              })
              break // Only count once per day
            }
          }
        }

        setFutureOccurrences(occurrences)
      } catch (err) {
        console.error('Failed to load future occurrences:', err)
      } finally {
        setIsLoadingFuture(false)
      }
    }

    loadFutureOccurrences()
  }, [activity, currentDate, storage])

  // Toggle a future occurrence's push state
  const toggleFuturePush = (index: number) => {
    setFutureOccurrences(prev =>
      prev.map((occ, i) =>
        i === index ? { ...occ, shouldPush: !occ.shouldPush } : occ
      )
    )
  }

  // Set all future occurrences to push or keep
  const setAllFuture = (shouldPush: boolean) => {
    setFutureOccurrences(prev =>
      prev.map(occ => ({ ...occ, shouldPush }))
    )
  }

  const handlePushSingle = () => {
    onPushSingle(futureOccurrences.filter(o => o.shouldPush))
  }

  const pushCount = futureOccurrences.filter(o => o.shouldPush).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl bg-card animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 border-b p-6 text-center shrink-0">
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Options */}
          <div className="p-4 space-y-2">
            {activity && (
              <button
                onClick={handlePushSingle}
                className="w-full flex items-center justify-between rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted"
              >
                <div>
                  <div className="font-medium">
                    Push {pushCount > 0 ? `${pushCount + 1} occurrence${pushCount > 0 ? 's' : ''}` : 'this activity'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {pushCount > 0
                      ? `Today + ${pushCount} future date${pushCount > 1 ? 's' : ''} → each shifts 1 day`
                      : `Move "${activity.name}" to tomorrow`
                    }
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
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
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            )}
          </div>

          {/* Future occurrences section */}
          {activity && futureOccurrences.length > 0 && (
            <div className="border-t">
              <button
                onClick={() => setShowFutureSection(!showFutureSection)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {futureOccurrences.length} more scheduled in next 30 days
                  </span>
                </div>
                {showFutureSection ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showFutureSection && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Quick actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAllFuture(true)}
                      className={cn(
                        "flex-1 text-xs py-1.5 px-3 rounded-lg border transition-colors",
                        pushCount === futureOccurrences.length
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      Push all
                    </button>
                    <button
                      onClick={() => setAllFuture(false)}
                      className={cn(
                        "flex-1 text-xs py-1.5 px-3 rounded-lg border transition-colors",
                        pushCount === 0
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      Keep all as-is
                    </button>
                  </div>

                  {/* Individual occurrences */}
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {futureOccurrences.map((occ, index) => (
                      <button
                        key={occ.date}
                        onClick={() => toggleFuturePush(index)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all",
                          occ.shouldPush
                            ? "bg-primary/10 border-primary/30"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                            occ.shouldPush
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}>
                            {occ.shouldPush && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{occ.dateLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {getDayDiff(currentDate, occ.date)}
                            </div>
                          </div>
                        </div>
                        {occ.shouldPush && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ArrowRight className="h-3 w-3" />
                            <span>+1 day</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Selected dates will each shift forward by 1 day
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {activity && isLoadingFuture && (
            <div className="border-t p-4 text-center text-sm text-muted-foreground">
              Checking for future occurrences...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t shrink-0">
          <Button
            variant="outline"
            className="w-full bg-transparent"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
