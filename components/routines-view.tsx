'use client'

import { useState, useEffect, useMemo } from 'react'
import { Star, Play, Edit2, Trash2, Check, X, ArrowUpDown, Clock, Calendar, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SavedPlanConfig } from '@/hooks/use-storage'
import { useSync } from '@/hooks/use-sync'
import { useActivities } from '@/hooks/use-activities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RoutinesViewProps {
  onBack: () => void
  onLoadRoutine: (routine: SavedPlanConfig) => void
}

type Tab = 'saved' | 'recent'
type SortMode = 'date' | 'name' | 'starred'

export function RoutinesView({ onBack, onLoadRoutine }: RoutinesViewProps) {
  const storage = useSync()
  const { getActivity } = useActivities()
  const [routines, setRoutines] = useState<SavedPlanConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('saved')
  const [sortMode, setSortMode] = useState<SortMode>('starred')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null)

  // Load all saved routines
  useEffect(() => {
    async function loadRoutines() {
      if (!storage.isReady) return
      try {
        const saved = await storage.getAllSavedRoutines()
        setRoutines(saved)
      } catch (e) {
        console.error('Failed to load routines:', e)
      } finally {
        setLoading(false)
      }
    }
    loadRoutines()
  }, [storage.isReady, storage.getAllSavedRoutines])

  // Filter routines by tab
  const filteredRoutines = useMemo(() => {
    if (activeTab === 'saved') {
      // Saved = named routines (not auto-saved) or starred
      return routines.filter(r => !r.isAutoSaved || r.starred)
    } else {
      // Recent = auto-saved only (not starred, not named)
      return routines.filter(r => r.isAutoSaved && !r.starred)
    }
  }, [routines, activeTab])

  // Sort routines
  const sortedRoutines = useMemo(() => {
    const sorted = [...filteredRoutines]
    switch (sortMode) {
      case 'starred':
        return sorted.sort((a, b) => {
          if (a.starred && !b.starred) return -1
          if (!a.starred && b.starred) return 1
          return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        })
      case 'name':
        return sorted.sort((a, b) => {
          const nameA = a.name || 'Untitled'
          const nameB = b.name || 'Untitled'
          return nameA.localeCompare(nameB)
        })
      case 'date':
        return sorted.sort((a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        )
      default:
        return sorted
    }
  }, [filteredRoutines, sortMode])

  const handleDelete = async (id: string) => {
    try {
      await storage.deleteRoutine(id)
      setRoutines(prev => prev.filter(r => r.id !== id))
      setDeleteConfirm(null)
    } catch (e) {
      console.error('Failed to delete routine:', e)
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    try {
      await storage.renameRoutine(id, editName.trim())
      setRoutines(prev => prev.map(r =>
        r.id === id ? { ...r, name: editName.trim(), isAutoSaved: false } : r
      ))
      setEditingId(null)
      setEditName('')
    } catch (e) {
      console.error('Failed to rename routine:', e)
    }
  }

  const handleToggleStar = async (id: string) => {
    try {
      const newStarred = await storage.toggleRoutineStar(id)
      setRoutines(prev => prev.map(r =>
        r.id === id ? { ...r, starred: newStarred, isAutoSaved: newStarred ? false : r.isAutoSaved } : r
      ))
    } catch (e) {
      console.error('Failed to toggle star:', e)
    }
  }

  const startEditing = (routine: SavedPlanConfig) => {
    setEditingId(routine.id)
    setEditName(routine.name || '')
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  const cycleSortMode = () => {
    const modes: SortMode[] = ['starred', 'date', 'name']
    const currentIndex = modes.indexOf(sortMode)
    setSortMode(modes[(currentIndex + 1) % modes.length])
  }

  const getSortLabel = () => {
    switch (sortMode) {
      case 'starred': return 'Starred first'
      case 'date': return 'By date'
      case 'name': return 'By name'
    }
  }

  // Get mind-body activities for a routine, sorted by frequency
  const getMindBodyActivities = (routine: SavedPlanConfig) => {
    // Count occurrences of each activity across heavy and light day schedules
    const activityCounts: Record<string, number> = {}

    const countInSchedule = (schedule: Record<string, string[]>) => {
      Object.values(schedule).forEach(activities => {
        activities.forEach(actId => {
          const activity = getActivity(actId)
          if (activity?.category === 'mind_body') {
            activityCounts[actId] = (activityCounts[actId] || 0) + 1
          }
        })
      })
    }

    if (routine.heavyDaySchedule) countInSchedule(routine.heavyDaySchedule)
    if (routine.lightDaySchedule) countInSchedule(routine.lightDaySchedule)

    // Sort by count descending
    return Object.entries(activityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([actId]) => getActivity(actId))
      .filter(Boolean)
  }

  const renderRoutineCard = (routine: SavedPlanConfig) => {
    const isExpanded = expandedRoutine === routine.id
    const mindBodyActivities = getMindBodyActivities(routine)

    return (
      <div
        key={routine.id}
        className={cn(
          "rounded-xl border bg-card transition-all",
          routine.starred && "border-yellow-500/50 bg-yellow-50/5"
        )}
      >
        {editingId === routine.id ? (
          <div className="p-4 space-y-3">
            {/* Show routine info above the input */}
            <div className="text-sm text-muted-foreground">
              {routine.selectedActivities.length} activities • {formatDate(routine.savedAt)}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(routine.id)
                  if (e.key === 'Escape') {
                    setEditingId(null)
                    setEditName('')
                  }
                }}
                placeholder="Give it a name..."
                autoFocus
                className="flex-1"
              />
              <button
                onClick={() => handleRename(routine.id)}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setEditName('')
                }}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : deleteConfirm === routine.id ? (
          <div className="p-4 space-y-3">
            <p className="text-sm">Delete "{routine.name || formatDate(routine.savedAt)}"?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(routine.id)}
                className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">
                    {routine.name || formatDate(routine.savedAt)}
                  </h3>
                  {routine.isAutoSaved && !routine.starred && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      Auto
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {routine.selectedActivities.length} activities
                  {routine.name && ` • ${formatDate(routine.savedAt)}`}
                </p>
              </div>
              <button
                onClick={() => handleToggleStar(routine.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors shrink-0",
                  routine.starred
                    ? "text-yellow-500 hover:bg-yellow-500/10"
                    : "text-muted-foreground hover:bg-muted"
                )}
                title={routine.starred ? "Unstar" : "Star"}
              >
                <Star className={cn("h-4 w-4", routine.starred && "fill-current")} />
              </button>
            </div>

            {/* Mind-body activities preview */}
            {mindBodyActivities.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1.5">
                  {mindBodyActivities.slice(0, isExpanded ? 10 : 3).map((activity, idx) => (
                    <span
                      key={`${routine.id}-${activity?.id}-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs"
                    >
                      {activity?.emoji} {activity?.name}
                    </span>
                  ))}
                  {mindBodyActivities.length > 3 && (
                    <button
                      onClick={() => setExpandedRoutine(isExpanded ? null : routine.id)}
                      className="text-xs text-primary hover:underline px-2 py-0.5"
                    >
                      {isExpanded ? 'Show less' : `+${mindBodyActivities.length - 3} more`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onLoadRoutine(routine)}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                Use This
              </Button>
              <button
                onClick={() => startEditing(routine)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title={routine.isAutoSaved ? "Save with name" : "Rename"}
              >
                <Edit2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setDeleteConfirm(routine.id)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const savedCount = routines.filter(r => !r.isAutoSaved || r.starred).length
  const recentCount = routines.filter(r => r.isAutoSaved && !r.starred).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Routines</h2>
          <p className="text-sm text-muted-foreground">
            {routines.length} routine{routines.length === 1 ? '' : 's'} saved
          </p>
        </div>
        <button
          onClick={cycleSortMode}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="Change sort order"
        >
          <ArrowUpDown className="h-4 w-4" />
          {getSortLabel()}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('saved')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === 'saved'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Saved ({savedCount})
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === 'recent'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Recent ({recentCount})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : sortedRoutines.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">
            {activeTab === 'saved' ? 'No saved routines yet' : 'No recent routines'}
          </p>
          <p className="text-sm text-muted-foreground">
            {activeTab === 'saved'
              ? 'Star or name a routine to save it here.'
              : 'Complete a 7-day plan to see it here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRoutines.map(renderRoutineCard)}
        </div>
      )}

      {/* Footer hint */}
      {!loading && routines.length > 0 && (
        <p className="text-xs text-center text-muted-foreground pt-2">
          {activeTab === 'saved'
            ? 'Star your favorites to keep them at the top'
            : 'Recent routines are auto-saved when you complete planning'}
        </p>
      )}
    </div>
  )
}
