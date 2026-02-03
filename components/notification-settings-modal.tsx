'use client'

import { useState } from 'react'
import { X, Bell, BellOff, Plus, Trash2, TestTube, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { formatNotificationTime, parseTimeString } from '@/lib/notifications'
import { subscribeToPush, isPushSupported } from '@/lib/push-subscription'

interface NotificationSettingsModalProps {
  onClose: () => void
}

export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  const {
    permissionStatus,
    preferences,
    nextNotificationIn,
    isPushSubscribed,
    requestPermission,
    updatePreferences,
    addNotificationTime,
    removeNotificationTime,
    updateNotificationTime,
    sendTestNotification
  } = useNotifications()

  const [showAddTime, setShowAddTime] = useState(false)
  const [newTimeValue, setNewTimeValue] = useState('12:00')
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  const handleEnableNotifications = async () => {
    if (permissionStatus === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.')
      return
    }
    const granted = await requestPermission()
    if (granted) {
      updatePreferences({ enabled: true })
    }
  }

  const handleToggleEnabled = () => {
    if (!preferences.enabled) {
      handleEnableNotifications()
    } else {
      updatePreferences({ enabled: false })
    }
  }

  const handleAddTime = () => {
    const { hour, minute } = parseTimeString(newTimeValue)
    addNotificationTime({ hour, minute, enabled: true })
    setShowAddTime(false)
    setNewTimeValue('12:00')
  }

  const handleToggleTime = (index: number) => {
    updateNotificationTime(index, { enabled: !preferences.times[index].enabled })
  }

  const handleSendTest = async () => {
    setTestStatus('Sending...')
    try {
      await sendTestNotification()
      setTestStatus('Sent! Check your notifications.')
    } catch (e) {
      setTestStatus(`Error: ${e}`)
    }
    setTimeout(() => setTestStatus(null), 5000)
  }

  const handleSyncToServer = async () => {
    if (!isPushSupported()) {
      setSyncStatus('Push not supported')
      setTimeout(() => setSyncStatus(null), 3000)
      return
    }

    setSyncStatus('Syncing...')
    try {
      const enabledTimes = preferences.times
        .filter(t => t.enabled)
        .map(t => ({ hour: t.hour, minute: t.minute }))

      const result = await subscribeToPush(enabledTimes)
      if (result) {
        setSyncStatus('Synced!')
      } else {
        setSyncStatus('Sync failed - check console')
      }
    } catch (e) {
      setSyncStatus(`Error: ${e}`)
    }
    setTimeout(() => setSyncStatus(null), 5000)
  }

  const formatCountdown = (ms: number | null): string => {
    if (ms === null) return 'Not scheduled'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `in ${hours}h ${minutes}m`
    return `in ${minutes}m`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                preferences.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {preferences.enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </div>
              <div>
                <p className="font-medium text-sm">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {preferences.enabled ? `Next: ${formatCountdown(nextNotificationIn)}` : 'Tap to enable'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                preferences.enabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <div className={cn(
                "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                preferences.enabled && "translate-x-5"
              )} />
            </button>
          </div>

          {/* Notification Times - only show if enabled */}
          {preferences.enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Check-in Times</h3>
                <button
                  onClick={() => setShowAddTime(true)}
                  className="flex items-center gap-1 text-xs text-primary"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {preferences.times.map((time, index) => (
                <div key={`${time.hour}-${time.minute}`} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleTime(index)}
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center",
                        time.enabled ? "bg-primary border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      {time.enabled && <span className="text-white text-xs">✓</span>}
                    </button>
                    <span className={cn("text-sm", !time.enabled && "text-muted-foreground")}>
                      {formatNotificationTime(time.hour, time.minute)}
                    </span>
                  </div>
                  <button onClick={() => removeNotificationTime(index)} className="p-1 text-muted-foreground">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {showAddTime && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <input
                    type="time"
                    value={newTimeValue}
                    onChange={(e) => setNewTimeValue(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm rounded border bg-background"
                  />
                  <button onClick={handleAddTime} className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded">
                    Add
                  </button>
                  <button onClick={() => setShowAddTime(false)} className="px-2 py-1 text-sm text-muted-foreground">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sync Button - only show if enabled */}
          {preferences.enabled && (
            <button
              type="button"
              onClick={handleSyncToServer}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-3 rounded-xl border touch-manipulation",
                syncStatus === 'Synced!'
                  ? "bg-green-50 border-green-200 text-green-700"
                  : syncStatus?.startsWith('Error') || syncStatus?.includes('failed')
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-orange-50 border-orange-200 text-orange-700 active:bg-orange-100"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", syncStatus === 'Syncing...' && "animate-spin")} />
              <span className="text-sm font-medium">{syncStatus || 'Sync to Server'}</span>
            </button>
          )}

          {/* Test Button */}
          <button
            type="button"
            onClick={handleSendTest}
            className={cn(
              "w-full flex items-center justify-center gap-2 p-3 rounded-xl border touch-manipulation",
              testStatus?.startsWith('Sent')
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-blue-50 border-blue-200 text-blue-700 active:bg-blue-100"
            )}
          >
            <TestTube className="h-4 w-4" />
            <span className="text-sm font-medium">{testStatus || 'Send Test Notification'}</span>
          </button>

          {/* Debug */}
          <p className="text-[10px] text-muted-foreground font-mono text-center">
            {permissionStatus} | sw={'serviceWorker' in navigator ? 'yes' : 'no'} | push={isPushSubscribed ? 'yes' : 'no'}
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
