'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Trash2, Play, Edit2, Check, Calendar, Star, ArrowUpDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SavedPlanConfig } from '@/hooks/use-storage'
import { useSync } from '@/hooks/use-sync'
import { useActivities } from '@/hooks/use-activities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RoutinesModalProps {
  onClose: () => void
  onLoadRoutine: (routine: SavedPlanConfig) => void
}

type Tab = 'saved' | 'recent'
type SortMode = 'date' | 'name' | 'starred'

export function RoutinesModal({ onClose, onLoadRoutine }: RoutinesModalProps) {
  const storage = useSync()
  const { getActivity } = useActivities()
  const [routines, setRoutines] = useState<SavedPlanConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('saved')
  const [sortMode, setSortMode] = useState<SortMode>('starred')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
      return routines.filter(r => !r.isAutoSaved || r.starred)
    } else {
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
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const cycleSortMode = () => {
    const modes: SortMode[] = ['starred', 'date', 'name']
    const currentIndex = modes.indexOf(sortMode)
    setSortMode(modes[(currentIndex + 1) % modes.length])
  }

  const getSortLabel = () => {
    switch (sortMode) {
      case 'starred': return 'Starred'
      case 'date': return 'Date'
      case 'name': return 'Name'
    }
  }

  const savedCount = routines.filter(r => !r.isAutoSaved || r.starred).length
  const recentCount = routines.filter(r => r.isAutoSaved && !r.starred).length

  const renderRoutineCard = (routine: SavedPlanConfig) => (
    <div
      key={routine.id}
      className={cn(
        "rounded-lg border bg-card p-3 transition-all",
        routine.starred && "border-yellow-500/50 bg-yellow-50/5"
      )}
    >
      {editingId === routine.id ? (
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
            className="flex-1 h-8 text-sm"
          />
          <button
            onClick={() => handleRename(routine.id)}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setEditingId(null)
              setEditName('')
            }}
            className="p-1.5 rounded-lg hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : deleteConfirm === routine.id ? (
        <div className="space-y-2">
          <p className="text-sm">Delete this routine?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 py-1.5 text-sm rounded-lg border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(routine.id)}
              className="flex-1 py-1.5 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLoadRoutine(routine)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">
                {routine.name || formatDate(routine.savedAt)}
              </p>
              {routine.isAutoSaved && !routine.starred && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  Auto
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {routine.selectedActivities.length} activities
              {routine.name && ` • ${formatDate(routine.savedAt)}`}
            </p>
          </button>
          <button
            onClick={() => handleToggleStar(routine.id)}
            className={cn(
              "p-1 rounded transition-colors shrink-0",
              routine.starred
                ? "text-yellow-500"
                : "text-muted-foreground hover:text-yellow-500"
            )}
          >
            <Star className={cn("h-4 w-4", routine.starred && "fill-current")} />
          </button>
          <button
            onClick={() => startEditing(routine)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm(routine.id)}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[65vh] rounded-xl bg-background flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold">Routines</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={cycleSortMode}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <ArrowUpDown className="h-3 w-3" />
              {getSortLabel()}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 border-b">
          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
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
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === 'recent'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Recent ({recentCount})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : sortedRoutines.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {activeTab === 'saved' ? 'No saved routines' : 'No recent routines'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedRoutines.map(renderRoutineCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
