'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Check, Loader2, ArrowRight, RefreshCw, Clock, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCoach, CoachSuggestion } from '@/hooks/use-coach'

interface HealthCoachModalProps {
  onClose: () => void
  onAcceptSuggestion: (activityId: string) => void
  onAddToToday?: (activityIds: string[]) => void
  onFocusForWeek?: (activityIds: string[]) => void
}

const FEELING_OPTIONS = [
  { label: 'Energized', emoji: '⚡', description: 'Ready to take on challenges' },
  { label: 'Tired', emoji: '😴', description: 'Low energy, need rest' },
  { label: 'Stressed', emoji: '😰', description: 'Feeling overwhelmed' },
  { label: 'Calm', emoji: '😌', description: 'Peaceful and relaxed' },
  { label: 'Motivated', emoji: '💪', description: 'Ready to push myself' },
  { label: 'Unfocused', emoji: '🌫️', description: 'Mind is scattered' }
]

export function HealthCoachModal({
  onClose,
  onAcceptSuggestion,
  onAddToToday,
  onFocusForWeek
}: HealthCoachModalProps) {
  const {
    isLoading,
    error,
    phase,
    recentActivities,
    hasRecentActivity,
    message,
    suggestions,
    storageReady,
    initialize,
    continueSimilar,
    startPersonalize,
    getPersonalizedSuggestions,
    refreshSuggestions,
    resetConversation
  } = useCoach()

  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null)
  const [customFeeling, setCustomFeeling] = useState('')
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [hasInitialized, setHasInitialized] = useState(false)
  const [localPhase, setLocalPhase] = useState<'suggestions' | 'choice'>('suggestions')

  // Ref to prevent double initialization due to React StrictMode or stale closures
  const initStartedRef = useRef(false)

  // Determine which phase to display (hook phase or local override)
  const displayPhase = phase === 'suggestions' ? localPhase : phase

  // Initialize when storage is ready, or after a timeout
  // Use ref to prevent double-init from React StrictMode or stale closures
  useEffect(() => {
    console.log('HealthCoachModal useEffect - storageReady:', storageReady, 'hasInitialized:', hasInitialized, 'initStarted:', initStartedRef.current)
    if (hasInitialized || initStartedRef.current) return

    if (storageReady) {
      console.log('Storage ready, calling initialize...')
      initStartedRef.current = true
      setHasInitialized(true)
      initialize()
      return
    }

    // Fallback: if storage isn't ready after 3 seconds, initialize anyway
    // (will show empty history, which is fine)
    const timeoutId = setTimeout(() => {
      if (!hasInitialized && !initStartedRef.current) {
        console.log('Storage timeout, initializing without history...')
        initStartedRef.current = true
        setHasInitialized(true)
        initialize()
      }
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [storageReady, hasInitialized, initialize])

  const handleGetPersonalized = () => {
    const feeling = selectedFeeling || customFeeling
    if (feeling) {
      getPersonalizedSuggestions(feeling)
    }
  }

  const handleToggleSuggestion = (suggestion: CoachSuggestion) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev)
      if (next.has(suggestion.activityId)) {
        next.delete(suggestion.activityId)
      } else {
        next.add(suggestion.activityId)
      }
      return next
    })
  }

  const formatLastCompleted = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 14) return 'last week'
    return `${Math.floor(diffDays / 7)} weeks ago`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-background rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95"
        style={{ maxHeight: 'min(500px, calc(100dvh - 120px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">Health Coach</h2>
              <p className="text-xs text-muted-foreground">Mind-body wellness</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Loading state */}
          {(phase === 'loading' || isLoading) && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                {phase === 'loading' ? 'Loading your activity history...' : 'Thinking...'}
              </span>
            </div>
          )}

          {/* PHASE: Recap */}
          {phase === 'recap' && !isLoading && (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-4">
                <p className="text-sm leading-relaxed">
                  Let me help you plan your mind-body activities for this week.
                </p>
              </div>

              {hasRecentActivity ? (
                <>
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      Your recent mind-body activities
                    </h3>
                    <div className="space-y-2">
                      {recentActivities.slice(0, 5).map(activity => (
                        <div
                          key={activity.activityId}
                          className="flex items-center justify-between p-3 rounded-xl border bg-card"
                        >
                          <div>
                            <p className="font-medium text-sm">{activity.activityName}</p>
                            <p className="text-xs text-muted-foreground">
                              Last: {formatLastCompleted(activity.lastCompleted)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-semibold text-primary">{activity.count}</span>
                            <span className="text-xs text-muted-foreground ml-1">times</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">
                      Would you like to continue with similar activities, or should I ask you a few questions to suggest something different?
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    I don't see any recent mind-body activity. Let me ask you a few questions to suggest some activities that might work well for you.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PHASE: Feeling */}
          {phase === 'feeling' && !isLoading && (
            <div className="space-y-3">
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3">
                <p className="text-sm leading-snug">
                  How have you been feeling lately? This helps me suggest activities that match your current state.
                </p>
              </div>

              {/* Feeling options - compact grid */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {FEELING_OPTIONS.map(option => (
                  <button
                    key={option.label}
                    onClick={() => {
                      setSelectedFeeling(option.label)
                      setCustomFeeling('')
                    }}
                    className={cn(
                      "p-2 sm:p-3 rounded-lg sm:rounded-xl border text-left transition-all",
                      selectedFeeling === option.label
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-lg sm:text-xl">{option.emoji}</span>
                      <span className="font-medium text-xs sm:text-sm">{option.label}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">{option.description}</p>
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div>
                <input
                  type="text"
                  placeholder="Or describe how you're feeling..."
                  value={customFeeling}
                  onChange={(e) => {
                    setCustomFeeling(e.target.value)
                    setSelectedFeeling(null)
                  }}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* PHASE: Suggestions */}
          {displayPhase === 'suggestions' && phase === 'suggestions' && !isLoading && (
            <div className="space-y-3">
              {/* Coach message */}
              {message && (
                <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3">
                  <p className="text-sm leading-snug whitespace-pre-wrap">{message}</p>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    Suggested for this week
                  </h3>
                  {suggestions.map(suggestion => {
                    const isSelected = selectedSuggestions.has(suggestion.activityId)
                    return (
                      <div
                        key={suggestion.activityId}
                        className={cn(
                          "rounded-lg border p-2.5 transition-all cursor-pointer",
                          isSelected ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card hover:bg-muted/50"
                        )}
                        onClick={() => handleToggleSuggestion(suggestion)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{suggestion.activityName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{suggestion.reasoning}</p>
                          </div>
                          <div
                            className={cn(
                              "shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-green-500 text-white"
                                : "bg-muted border-2 border-muted-foreground/30"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Get more suggestions button */}
                  <button
                    onClick={() => {
                      // Keep selected suggestions, get more new ones
                      refreshSuggestions(Array.from(selectedSuggestions))
                    }}
                    className="w-full p-2.5 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-sm">Get more suggestions</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PHASE: Choice (Add to Today vs Focus for Week) */}
          {displayPhase === 'choice' && !isLoading && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3">
                <p className="text-sm leading-snug">
                  Great choices! How would you like to incorporate these activities?
                </p>
              </div>

              <div className="space-y-2">
                {/* Add to Today option */}
                <button
                  onClick={() => {
                    const activityIds = Array.from(selectedSuggestions)
                    if (onAddToToday) {
                      onAddToToday(activityIds)
                    } else {
                      // Fallback: add each suggestion via the old callback
                      activityIds.forEach(id => onAcceptSuggestion(id))
                    }
                    onClose()
                  }}
                  className="w-full p-3 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Add to Today</p>
                      <p className="text-xs text-muted-foreground">
                        Schedule these activities for today
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>

                {/* Focus for Week option */}
                <button
                  onClick={() => {
                    const activityIds = Array.from(selectedSuggestions)
                    if (onFocusForWeek) {
                      onFocusForWeek(activityIds)
                    } else {
                      // Fallback: add each suggestion via the old callback
                      activityIds.forEach(id => onAcceptSuggestion(id))
                    }
                    onClose()
                  }}
                  className="w-full p-3 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Focus for the Week</p>
                      <p className="text-xs text-muted-foreground">
                        Plan these activities across the next 7 days
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t shrink-0">
          {phase === 'recap' && !isLoading && (
            <div className="flex gap-2">
              {hasRecentActivity ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={continueSimilar}
                  >
                    Continue Similar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={startPersonalize}
                  >
                    Personalize
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Skip
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={startPersonalize}
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              )}
            </div>
          )}

          {phase === 'feeling' && !isLoading && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => resetConversation()}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleGetPersonalized}
                disabled={!selectedFeeling && !customFeeling}
              >
                Get Suggestions
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {displayPhase === 'suggestions' && phase === 'suggestions' && !isLoading && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  resetConversation()
                  setLocalPhase('suggestions')
                  initialize()
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Start Over
              </Button>
              <Button
                className="flex-1"
                onClick={() => setLocalPhase('choice')}
                disabled={selectedSuggestions.size === 0}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {displayPhase === 'choice' && !isLoading && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLocalPhase('suggestions')}
              >
                Back
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Skip
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
