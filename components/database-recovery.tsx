'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DatabaseRecoveryProps {
  onRetry: () => void
  onClear: () => Promise<void>
}

export function DatabaseRecovery({ onRetry, onClear }: DatabaseRecoveryProps) {
  const [isClearing, setIsClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  const handleClear = async () => {
    setIsClearing(true)
    try {
      await onClear()
      setCleared(true)
      // Auto-refresh after clearing
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Failed to clear database:', error)
      alert('Failed to clear database. Please try manually clearing browser data.')
    } finally {
      setIsClearing(false)
    }
  }

  if (cleared) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <RefreshCw className="h-8 w-8 text-green-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold">Database Cleared</h2>
          <p className="text-muted-foreground">Refreshing page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border p-6 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold">Database Connection Issue</h2>
          <p className="text-muted-foreground text-sm">
            The app is having trouble connecting to local storage. This can happen after browser updates or if the database became corrupted.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleClear}
            disabled={isClearing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isClearing ? 'Clearing...' : 'Clear Database & Restart'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Clearing the database will remove your saved schedules and completion history. Your activities from Notion will remain.
          </p>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Manual fix:</strong> Open DevTools (F12) → Application → IndexedDB → Right-click "BuildingNickDB" → Delete database → Refresh page
          </p>
        </div>
      </div>
    </div>
  )
}
