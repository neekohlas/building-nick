'use client'

import { useState, useEffect } from 'react'
import { X, Activity, Loader2, Check, ChevronDown, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStrava, type StravaImportItem } from '@/hooks/use-strava'
import { useActivities } from '@/hooks/use-activities'
import { useSync } from '@/hooks/use-sync'
import type { Completion } from '@/hooks/use-storage'
import type { Activity as AppActivity } from '@/lib/activities'

interface StravaImportModalProps {
  onClose: () => void
  onImported: (count: number) => void
}

const DATE_RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
]

function formatDistance(meters: number): string {
  const km = meters / 1000
  if (km >= 1) {
    return `${km.toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Strava activity type badge colors
function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Run':
    case 'TrailRun':
    case 'VirtualRun':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'Ride':
    case 'MountainBikeRide':
    case 'GravelRide':
    case 'VirtualRide':
    case 'EBikeRide':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Walk':
    case 'Hike':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'Swim':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
    case 'WeightTraining':
    case 'Crossfit':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
}

// Make Strava type human-readable
function formatStravaType(type: string): string {
  return type.replace(/([A-Z])/g, ' $1').trim()
}

export function StravaImportModal({ onClose, onImported }: StravaImportModalProps) {
  const { fetchActivities, buildImportItems, isFetchingActivities, error } = useStrava()
  const { activities: appActivities, getActivity } = useActivities()
  const storage = useSync()

  const [daysBack, setDaysBack] = useState(7)
  const [importItems, setImportItems] = useState<StravaImportItem[]>([])
  const [existingCompletions, setExistingCompletions] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<number | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Sort app activities: physical first, then by name
  const sortedAppActivities = Object.values(appActivities).sort((a: AppActivity, b: AppActivity) => {
    if (a.category === 'physical' && b.category !== 'physical') return -1
    if (a.category !== 'physical' && b.category === 'physical') return 1
    return a.name.localeCompare(b.name)
  })

  // Fetch activities when modal opens or date range changes
  useEffect(() => {
    async function load() {
      const stravaActivities = await fetchActivities(daysBack)
      const availableIds = new Set(Object.values(appActivities).map((a: AppActivity) => a.id))
      const items = buildImportItems(stravaActivities, availableIds)
      setImportItems(items)
      setHasLoaded(true)

      // Check for existing completions to detect duplicates
      const dates = [...new Set(items.map(item => item.date))]
      const existingKeys = new Set<string>()

      for (const date of dates) {
        const completions = await storage.getCompletionsForDate(date)
        completions.forEach((c: Completion) => {
          existingKeys.add(`${c.date}_${c.activityId}`)
        })
      }
      setExistingCompletions(existingKeys)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysBack])

  const toggleItem = (index: number) => {
    setImportItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  const setActivityMapping = (index: number, activityId: string) => {
    setImportItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selectedActivityId: activityId, selected: true } : item
    ))
    setPickerOpen(null)
  }

  const isItemAlreadyLogged = (item: StravaImportItem) =>
    item.selectedActivityId ? existingCompletions.has(`${item.date}_${item.selectedActivityId}`) : false

  const selectedCount = importItems.filter(item => item.selected && item.selectedActivityId && !isItemAlreadyLogged(item)).length

  const handleImport = async () => {
    const toImport = importItems.filter(item => item.selected && item.selectedActivityId && !isItemAlreadyLogged(item))
    if (toImport.length === 0) return

    setIsImporting(true)
    try {
      for (const item of toImport) {
        // Find next available instance index
        let instanceIndex = 0
        const completions = await storage.getCompletionsForDate(item.date)
        const existingForSlot = completions.filter(
          (c: Completion) => c.activityId === item.selectedActivityId && c.timeBlock === item.timeBlock
        )
        if (existingForSlot.length > 0) {
          instanceIndex = Math.max(...existingForSlot.map((c: Completion) => c.instanceIndex)) + 1
        }

        await storage.saveCompletion({
          date: item.date,
          activityId: item.selectedActivityId!,
          timeBlock: item.timeBlock,
          instanceIndex,
          durationMinutes: item.durationMinutes,
          stravaActivityName: item.stravaActivity.name,
          stravaDistance: item.stravaActivity.distance,
          stravaSportType: item.stravaActivity.sport_type,
          stravaCalories: item.stravaActivity.kilojoules,
          stravaAvgHeartrate: item.stravaActivity.average_heartrate,
        })
      }

      onImported(toImport.length)
      onClose()
    } catch (err) {
      console.error('Failed to import Strava activities:', err)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col"
        style={{ maxHeight: 'calc(100vh - 7rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Import from Strava</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 p-4 pb-2 shrink-0">
          {DATE_RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setDaysBack(option.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                daysBack === option.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-2">
          {isFetchingActivities && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm text-muted-foreground">Fetching activities...</p>
            </div>
          )}

          {hasLoaded && !isFetchingActivities && importItems.length === 0 && (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No activities found in the last {daysBack} days</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {importItems.map((item, index) => {
            const isAlreadyLogged = isItemAlreadyLogged(item)
            const mappedActivity = item.selectedActivityId ? getActivity(item.selectedActivityId) : null

            return (
              <div
                key={item.stravaActivity.id}
                className={cn(
                  'rounded-xl border p-3 transition-all',
                  item.selected && !isAlreadyLogged ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20' : 'bg-card',
                  isAlreadyLogged && 'opacity-50'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => !isAlreadyLogged && toggleItem(index)}
                    disabled={isAlreadyLogged}
                    className="mt-0.5 shrink-0"
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border-2 transition-all',
                        item.selected && !isAlreadyLogged
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-border',
                        isAlreadyLogged && 'border-green-500 bg-green-500 text-white'
                      )}
                    >
                      {(item.selected || isAlreadyLogged) && <Check className="h-3 w-3" />}
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Top row: name + type badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{item.stravaActivity.name}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getTypeBadgeColor(item.stravaActivity.sport_type))}>
                        {formatStravaType(item.stravaActivity.sport_type)}
                      </span>
                    </div>

                    {/* Details row */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatDate(item.date)}</span>
                      <span>{formatDuration(item.durationMinutes)}</span>
                      {item.stravaActivity.distance > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {formatDistance(item.stravaActivity.distance)}
                        </span>
                      )}
                    </div>

                    {/* Already logged badge */}
                    {isAlreadyLogged && (
                      <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                        Already logged
                      </span>
                    )}

                    {/* Activity Mapping */}
                    {!isAlreadyLogged && (
                      <div className="mt-2 relative">
                        <button
                          onClick={() => setPickerOpen(pickerOpen === index ? null : index)}
                          className={cn(
                            'flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors',
                            mappedActivity
                              ? 'border-border bg-muted/50'
                              : 'border-dashed border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400'
                          )}
                        >
                          <span className="flex-1 truncate">
                            {mappedActivity ? `→ ${mappedActivity.name}` : 'Select activity...'}
                          </span>
                          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', pickerOpen === index && 'rotate-180')} />
                        </button>

                        {/* Dropdown picker */}
                        {pickerOpen === index && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {sortedAppActivities.map((activity: AppActivity) => (
                              <button
                                key={activity.id}
                                onClick={() => setActivityMapping(index, activity.id)}
                                className={cn(
                                  'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2',
                                  item.selectedActivityId === activity.id && 'bg-orange-50 dark:bg-orange-950/20'
                                )}
                              >
                                <span className={cn(
                                  'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                                  activity.category === 'physical' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  activity.category === 'mind_body' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                )}>
                                  {activity.category === 'physical' ? 'Body' : activity.category === 'mind_body' ? 'Mind' : 'Pro'}
                                </span>
                                <span className="truncate">{activity.name}</span>
                                {item.selectedActivityId === activity.id && (
                                  <Check className="h-3 w-3 text-orange-500 ml-auto shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t p-4 shrink-0">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            disabled={selectedCount === 0 || isImporting}
            onClick={handleImport}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${selectedCount} Activit${selectedCount === 1 ? 'y' : 'ies'}`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
