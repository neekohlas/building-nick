'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  parseRemindersFromClipboard,
  syncReminders,
  type ReminderSyncResult
} from '@/lib/reminders'

interface RemindersSyncModalProps {
  onClose: () => void
  onSyncComplete: (result: ReminderSyncResult) => void
}

export function RemindersSyncModal({ onClose, onSyncComplete }: RemindersSyncModalProps) {
  const [pasteText, setPasteText] = useState('')
  const [status, setStatus] = useState<'idle' | 'reading' | 'success' | 'error'>('reading')
  const [errorMessage, setErrorMessage] = useState('')
  const [syncResult, setSyncResult] = useState<ReminderSyncResult | null>(null)

  // Try to read clipboard automatically on mount
  useEffect(() => {
    async function tryReadClipboard() {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text.includes('"id":')) {
          // Looks like reminders data, try to sync
          const reminders = parseRemindersFromClipboard(text)
          if (reminders.length > 0) {
            const result = syncReminders(reminders)
            setSyncResult(result)
            setStatus('success')
            // Auto-close after short delay on success
            setTimeout(() => {
              onSyncComplete(result)
              onClose()
            }, 1500)
            return
          }
        }
        // Clipboard didn't have valid data, show manual paste option
        setStatus('idle')
      } catch (error) {
        console.log('Clipboard read failed, showing manual paste:', error)
        setStatus('idle')
      }
    }

    tryReadClipboard()
  }, [onClose, onSyncComplete])

  const handleManualSync = () => {
    if (!pasteText.trim()) {
      setErrorMessage('Please paste the reminders data')
      setStatus('error')
      return
    }

    try {
      const reminders = parseRemindersFromClipboard(pasteText)
      console.log('[RemindersSyncModal] Parsed reminders:', reminders.length, reminders)
      if (reminders.length === 0) {
        setErrorMessage('No valid reminders found in the pasted data')
        setStatus('error')
        return
      }

      const result = syncReminders(reminders)
      console.log('[RemindersSyncModal] Sync result:', result)
      setSyncResult(result)
      setStatus('success')

      // Auto-close after short delay
      setTimeout(() => {
        onSyncComplete(result)
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Failed to parse reminders:', error)
      setErrorMessage('Failed to parse reminders data. Make sure you copied the right content.')
      setStatus('error')
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setPasteText(text)
      setStatus('idle')
      setErrorMessage('')
    } catch (error) {
      setErrorMessage('Could not read clipboard. Please paste manually.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Sync Reminders</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {status === 'reading' && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-muted-foreground">Reading clipboard...</p>
            </div>
          )}

          {status === 'success' && syncResult && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-lg">Sync Complete!</p>
              <p className="text-muted-foreground mt-1">
                {syncResult.added} new, {syncResult.updated} updated
              </p>
            </div>
          )}

          {(status === 'idle' || status === 'error') && (
            <>
              <p className="text-sm text-muted-foreground">
                Automatic clipboard reading didn't work. Please paste the reminders data below:
              </p>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePasteFromClipboard}
                    className="flex-1"
                  >
                    <Clipboard className="h-4 w-4 mr-2" />
                    Paste from Clipboard
                  </Button>
                </div>

                <textarea
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value)
                    setStatus('idle')
                    setErrorMessage('')
                  }}
                  placeholder='Paste reminders data here (starts with {"id":...)'
                  className="w-full h-32 p-3 text-sm border rounded-lg bg-background resize-none font-mono"
                />
              </div>

              {status === 'error' && errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleManualSync} className="flex-1">
                  Sync Reminders
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
