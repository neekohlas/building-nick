'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Play, Edit2, Check, Plus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorage, SavedPlanConfig } from '@/hooks/use-storage'
import { useActivities } from '@/hooks/use-activities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RoutinesModalProps {
  onClose: () => void
  onLoadRoutine: (routine: SavedPlanConfig) => void
  onSaveCurrentAsRoutine?: () => void
}

export function RoutinesModal({ onClose, onLoadRoutine, onSaveCurrentAsRoutine }: RoutinesModalProps) {
  const storage = useStorage()
  const { getActivity } = useActivities()
  const [routines, setRoutines] = useState<SavedPlanConfig[]>([])
  const [loading, setLoading] = useState(true)
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
        r.id === id ? { ...r, name: editName.trim() } : r
      ))
      setEditingId(null)
      setEditName('')
    } catch (e) {
      console.error('Failed to rename routine:', e)
    }
  }

  const startEditing = (routine: SavedPlanConfig) => {
    setEditingId(routine.id)
    setEditName(routine.name || 'Unnamed Routine')
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  // Get activity count summary
  const getRoutineSummary = (routine: SavedPlanConfig) => {
    const count = routine.selectedActivities?.length || 0
    return `${count} activit${count === 1 ? 'y' : 'ies'}`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-background flex flex-col animate-in fade-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Saved Routines</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : routines.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No saved routines yet</p>
              <p className="text-sm text-muted-foreground">
                After planning your week, you can save it as a routine to reuse later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {routines.map(routine => (
                <div
                  key={routine.id}
                  className="rounded-xl border bg-card p-4 transition-all hover:border-muted-foreground/30"
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
                  ) : deleteConfirm === routine.id ? (
                    <div className="space-y-3">
                      <p className="text-sm">Delete "{routine.name || 'Unnamed Routine'}"?</p>
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
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">
                            {routine.name || 'Unnamed Routine'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {getRoutineSummary(routine)} • Saved {formatDate(routine.savedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Activity preview */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {routine.selectedActivities?.slice(0, 5).map(actId => {
                          const activity = getActivity(actId)
                          if (!activity) return null
                          return (
                            <span
                              key={actId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
                            >
                              {activity.emoji} {activity.name}
                            </span>
                          )
                        })}
                        {(routine.selectedActivities?.length || 0) > 5 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                            +{routine.selectedActivities.length - 5} more
                          </span>
                        )}
                      </div>

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
                          title="Rename"
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
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-center text-muted-foreground">
            {routines.length > 0
              ? `${routines.length} saved routine${routines.length === 1 ? '' : 's'}`
              : 'Save routines from the planning screen'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
