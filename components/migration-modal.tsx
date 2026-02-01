'use client'

import { useState } from 'react'
import { X, Cloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface MigrationModalProps {
  onClose: () => void
  onMigrate: () => Promise<{ success: boolean; error?: string; counts?: { completions: number; schedules: number; planConfigs: number } }>
}

export function MigrationModal({ onClose, onMigrate }: MigrationModalProps) {
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState<{ completions: number; schedules: number; planConfigs: number } | null>(null)

  const handleMigrate = async () => {
    setStatus('migrating')
    setError(null)

    try {
      const result = await onMigrate()

      if (result.success) {
        setStatus('success')
        setCounts(result.counts || null)
      } else {
        setStatus('error')
        setError(result.error || 'Migration failed')
      }
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-2xl max-w-md w-full p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Sync Data to Cloud</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full"
            disabled={status === 'migrating'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content based on status */}
        {status === 'idle' && (
          <>
            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl mb-4">
              <Cloud className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Keep your data safe
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Sync your activities, schedules, and progress to the cloud so you never lose them.
                </p>
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Access your data on any device
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Automatically backs up your progress
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Never lose your data again
              </li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Not Now
              </button>
              <button
                onClick={handleMigrate}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Sync Now
              </button>
            </div>
          </>
        )}

        {status === 'migrating' && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="font-medium">Syncing your data...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="font-medium text-lg">Sync Complete!</p>
            {counts && (
              <p className="text-sm text-muted-foreground mt-2">
                Synced {counts.completions} completions, {counts.schedules} schedules
                {counts.planConfigs > 0 && ', and your plan configuration'}
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <p className="font-medium text-lg">Sync Failed</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error || 'Something went wrong. Please try again.'}
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleMigrate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
