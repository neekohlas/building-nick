'use client'

import { useState } from 'react'
import { X, Bell, BellOff, Plus, Trash2, TestTube } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import { formatNotificationTime, parseTimeString, NotificationTime } from '@/lib/notifications'

interface NotificationSettingsModalProps {
  onClose: () => void
}

export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  const {
    permissionStatus,
    preferences,
    nextNotificationIn,
    requestPermission,
    updatePreferences,
    addNotificationTime,
    removeNotificationTime,
    updateNotificationTime,
    sendTestNotification
  } = useNotifications()

  const [showAddTime, setShowAddTime] = useState(false)
  const [newTimeValue, setNewTimeValue] = useState('12:00')
  const [testSent, setTestSent] = useState(false)

  const handleEnableNotifications = async () => {
    if (permissionStatus === 'denied') {
      // Can't request again, show instructions
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
    await sendTestNotification()
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }

  // Format countdown
  const formatCountdown = (ms: number | null): string => {
    if (ms === null) return 'Not scheduled'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`
    }
    return `in ${minutes}m`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-background rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Notification Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Permission Status */}
          {permissionStatus === 'unsupported' && (
            <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <BellOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">Not Supported</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Your browser doesn't support notifications. Try using Safari on iOS or Chrome on desktop.
                  </p>
                </div>
              </div>
            </div>
          )}

          {permissionStatus === 'denied' && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <BellOff className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">Notifications Blocked</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    You've blocked notifications. To enable them, open your browser settings and allow notifications for this site.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Enable Toggle */}
          {permissionStatus !== 'unsupported' && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  preferences.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {preferences.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {preferences.enabled
                      ? `Next: ${formatCountdown(nextNotificationIn)}`
                      : 'Get reminders throughout the day'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleEnabled}
                disabled={permissionStatus === 'denied'}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-colors",
                  preferences.enabled ? "bg-primary" : "bg-muted-foreground/30",
                  permissionStatus === 'denied' && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform",
                  preferences.enabled && "translate-x-5"
                )} />
              </button>
            </div>
          )}

          {/* Notification Times */}
          {preferences.enabled && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Check-in Times</h3>
                <button
                  onClick={() => setShowAddTime(true)}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Add Time
                </button>
              </div>

              <div className="space-y-2">
                {preferences.times.map((time, index) => (
                  <div
                    key={`${time.hour}-${time.minute}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleTime(index)}
                        className={cn(
                          "w-5 h-5 rounded border-2 transition-colors",
                          time.enabled
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {time.enabled && (
                          <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <span className={cn(
                        "font-medium",
                        !time.enabled && "text-muted-foreground"
                      )}>
                        {formatNotificationTime(time.hour, time.minute)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeNotificationTime(index)}
                      className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Time Input */}
              {showAddTime && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <input
                    type="time"
                    value={newTimeValue}
                    onChange={(e) => setNewTimeValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border bg-background"
                  />
                  <button
                    onClick={handleAddTime}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddTime(false)}
                    className="px-4 py-2 text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {preferences.times.length === 0 && !showAddTime && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No notification times set. Add a time to receive check-ins.
                </p>
              )}
            </div>
          )}

          {/* Test Notification - always show for debugging */}
          <div className="pt-4 border-t">
            <button
              onClick={handleSendTest}
              disabled={testSent || permissionStatus !== 'granted'}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-3 rounded-xl border transition-colors",
                testSent
                  ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                  : permissionStatus !== 'granted'
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-muted active:bg-muted"
              )}
            >
              <TestTube className="h-5 w-5" />
              <span className="font-medium">
                {testSent ? 'Test Sent!' : permissionStatus !== 'granted' ? `Test (need permission: ${permissionStatus})` : 'Send Test Notification'}
              </span>
            </button>
          </div>

          {/* Debug info - remove after testing */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground font-mono">
              Debug: permission={permissionStatus}, enabled={String(preferences.enabled)},
              swSupport={'serviceWorker' in navigator ? 'yes' : 'no'}
            </p>
          </div>

          {/* How it works */}
          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">How notifications work</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">1.</span>
                <span>At each check-in time, you'll get a notification with your progress</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">2.</span>
                <span>Completed items are celebrated, pending items get encouragement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">3.</span>
                <span>When you're caught up, you'll see what's coming next</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
