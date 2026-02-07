'use client'

import { useState } from 'react'
import { X, Activity, LogOut, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StravaSettingsModalProps {
  athleteName: string | null
  onClose: () => void
  onDisconnect: () => Promise<void>
  onOpenImport: () => void
}

export function StravaSettingsModal({
  athleteName,
  onClose,
  onDisconnect,
  onOpenImport
}: StravaSettingsModalProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await onDisconnect()
      onClose()
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Strava Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Connected Account */}
          {athleteName && (
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <p className="text-xs text-muted-foreground mb-1">Connected account</p>
              <p className="font-medium text-sm">{athleteName}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={onOpenImport}
            >
              <Download className="h-4 w-4 mr-2" />
              Import Activities
            </Button>

            {!showDisconnectConfirm ? (
              <Button
                variant="outline"
                className="w-full bg-transparent text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect Strava
              </Button>
            ) : (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <p className="text-sm text-center">
                  Are you sure you want to disconnect?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
