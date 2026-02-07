'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Check, Loader2, ArrowRight, RefreshCw, Clock, CalendarDays, ChevronLeft, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useCoach, CoachSuggestion } from '@/hooks/use-coach'
import { useSync } from '@/hooks/use-sync'
import { formatDateISO } from '@/lib/date-utils'

interface HealthCoachModalProps {
  onClose: () => void
  onAddToToday?: (activityIds: string[]) => void
  onDoItNow?: (activityId: string) => void
  onFocusForWeek?: (activityIds: string[]) => void
}

// 2-step emotion categories based on the How We Feel / mood meter model
// Optimized for chronic pain context
interface EmotionOption {
  id: string
  label: string
  emoji: string
}

interface EmotionCategory {
  id: string
  label: string
  emoji: string
  color: string
  description: string
  emotions: EmotionOption[]
}

const EMOTION_CATEGORIES: EmotionCategory[] = [
  {
    id: 'energized',
    label: 'Energized',
    emoji: '✨',
    color: '#F59E0B',
    description: 'High energy, positive',
    emotions: [
      { id: 'excited', label: 'Excited', emoji: '🤩' },
      { id: 'motivated', label: 'Motivated', emoji: '🔥' },
      { id: 'hopeful', label: 'Hopeful', emoji: '🌅' },
      { id: 'proud', label: 'Proud', emoji: '💪' },
      { id: 'joyful', label: 'Joyful', emoji: '😄' },
      { id: 'inspired', label: 'Inspired', emoji: '💡' },
    ]
  },
  {
    id: 'calm',
    label: 'Calm',
    emoji: '😌',
    color: '#10B981',
    description: 'Low energy, positive',
    emotions: [
      { id: 'peaceful', label: 'Peaceful', emoji: '🕊️' },
      { id: 'grateful', label: 'Grateful', emoji: '🙏' },
      { id: 'content', label: 'Content', emoji: '😊' },
      { id: 'relieved', label: 'Relieved', emoji: '😮‍💨' },
      { id: 'accepting', label: 'Accepting', emoji: '🤲' },
      { id: 'safe', label: 'Safe', emoji: '🛡️' },
    ]
  },
  {
    id: 'meh',
    label: 'Meh',
    emoji: '😐',
    color: '#8B8B8B',
    description: 'Neutral or mixed',
    emotions: [
      { id: 'numb', label: 'Numb', emoji: '😶' },
      { id: 'distracted', label: 'Distracted', emoji: '🌀' },
      { id: 'uncertain', label: 'Uncertain', emoji: '🤷' },
      { id: 'bored', label: 'Bored', emoji: '😒' },
      { id: 'restless', label: 'Restless', emoji: '⏳' },
      { id: 'indifferent', label: 'Flat', emoji: '😑' },
    ]
  },
  {
    id: 'stressed',
    label: 'Stressed',
    emoji: '😤',
    color: '#EF4444',
    description: 'High energy, unpleasant',
    emotions: [
      { id: 'frustrated', label: 'Frustrated', emoji: '😠' },
      { id: 'anxious', label: 'Anxious', emoji: '😰' },
      { id: 'overwhelmed', label: 'Overwhelmed', emoji: '🤯' },
      { id: 'irritable', label: 'Irritable', emoji: '😬' },
      { id: 'angry', label: 'Angry', emoji: '💢' },
      { id: 'fearful', label: 'Fearful', emoji: '😨' },
    ]
  },
  {
    id: 'down',
    label: 'Down',
    emoji: '😔',
    color: '#6366F1',
    description: 'Low energy, unpleasant',
    emotions: [
      { id: 'sad', label: 'Sad', emoji: '😢' },
      { id: 'exhausted', label: 'Exhausted', emoji: '😩' },
      { id: 'lonely', label: 'Lonely', emoji: '🥀' },
      { id: 'hopeless', label: 'Hopeless', emoji: '🌧️' },
      { id: 'guilty', label: 'Guilty', emoji: '😞' },
      { id: 'grieving', label: 'Grieving', emoji: '💔' },
    ]
  },
]

export function HealthCoachModal({
  onClose,
  onAddToToday,
  onDoItNow,
  onFocusForWeek
}: HealthCoachModalProps) {
  const {
    isLoading,
    error,
    phase,
    message,
    suggestions,
    storageReady,
    initialize,
    getPersonalizedSuggestions,
    refreshSuggestions,
    resetConversation
  } = useCoach()

  const storage = useSync()

  // Emotion selection state (2-step)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null)
  const [customFeeling, setCustomFeeling] = useState('')
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [hasInitialized, setHasInitialized] = useState(false)
  const [localPhase, setLocalPhase] = useState<'suggestions' | 'choice'>('suggestions')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initStartedRef = useRef(false)

  const displayPhase = phase === 'suggestions' ? localPhase : phase

  // Initialize when storage is ready
  useEffect(() => {
    if (hasInitialized || initStartedRef.current) return

    if (storageReady) {
      initStartedRef.current = true
      setHasInitialized(true)
      initialize()
      return
    }

    const timeoutId = setTimeout(() => {
      if (!hasInitialized && !initStartedRef.current) {
        initStartedRef.current = true
        setHasInitialized(true)
        initialize()
      }
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [storageReady, hasInitialized, initialize])

  // Build the feeling string from category + emotion + custom text
  const getFeelingString = (): string => {
    const parts: string[] = []
    if (selectedEmotion) {
      const cat = EMOTION_CATEGORIES.find(c => c.id === selectedCategory)
      const emo = cat?.emotions.find(e => e.id === selectedEmotion)
      if (emo) parts.push(emo.label)
    } else if (selectedCategory) {
      const cat = EMOTION_CATEGORIES.find(c => c.id === selectedCategory)
      if (cat) parts.push(cat.label)
    }
    if (customFeeling.trim()) parts.push(customFeeling.trim())
    return parts.join(' — ')
  }

  const canSubmitFeeling = selectedCategory || selectedEmotion || customFeeling.trim()

  const handleGetPersonalized = () => {
    const feeling = getFeelingString()
    if (feeling) {
      // Save mood entry to storage
      if (selectedCategory && storage.isReady) {
        const today = formatDateISO(new Date())
        storage.saveMoodEntry({
          date: today,
          category: selectedCategory,
          emotion: selectedEmotion || undefined,
          notes: customFeeling.trim() || undefined,
        }).catch(err => console.error('Failed to save mood entry:', err))
      }
      getPersonalizedSuggestions(feeling)
    }
  }

  // Handle Enter key in textarea (submit on Enter, newline on Shift+Enter)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmitFeeling) {
        handleGetPersonalized()
      }
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

  const activeCategory = EMOTION_CATEGORIES.find(c => c.id === selectedCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-4 px-4 bg-black/50">
      <div
        className="bg-background rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95"
        style={{ maxHeight: 'calc(100dvh - 4rem)' }}
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
                {phase === 'loading' ? 'Loading...' : 'Thinking...'}
              </span>
            </div>
          )}

          {/* PHASE: Feeling — 2-step emotion selection */}
          {phase === 'feeling' && !isLoading && (
            <div className="space-y-3">
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3">
                <p className="text-sm leading-snug">
                  {!selectedCategory
                    ? 'How are you feeling right now? Tap what resonates.'
                    : `You're feeling ${activeCategory?.label.toLowerCase()}. Anything more specific?`
                  }
                </p>
              </div>

              {/* Step 1: Category selection */}
              {!selectedCategory ? (
                <div className="grid grid-cols-5 gap-1.5">
                  {EMOTION_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:bg-muted transition-all"
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <span className="text-[10px] font-medium text-center leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {/* Category chip (tappable to go back) */}
                  <button
                    onClick={() => {
                      setSelectedCategory(null)
                      setSelectedEmotion(null)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: `${activeCategory?.color}20`,
                      color: activeCategory?.color,
                      borderColor: `${activeCategory?.color}40`,
                      borderWidth: 1,
                    }}
                  >
                    <ChevronLeft className="h-3 w-3" />
                    <span>{activeCategory?.emoji} {activeCategory?.label}</span>
                  </button>

                  {/* Step 2: Specific emotions within category */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {activeCategory?.emotions.map(emo => (
                      <button
                        key={emo.id}
                        onClick={() => setSelectedEmotion(
                          selectedEmotion === emo.id ? null : emo.id
                        )}
                        className={cn(
                          "flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all text-sm",
                          selectedEmotion === emo.id
                            ? "ring-2 ring-primary/30"
                            : "hover:bg-muted"
                        )}
                        style={selectedEmotion === emo.id ? {
                          backgroundColor: `${activeCategory.color}15`,
                          borderColor: activeCategory.color,
                        } : undefined}
                      >
                        <span className="text-base">{emo.emoji}</span>
                        <span className="font-medium text-xs">{emo.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Expanded text input — always visible, encourages deeper reflection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground px-1">
                  Tell me more about how you're feeling...
                </label>
                <textarea
                  ref={textareaRef}
                  placeholder="What's on your mind? How's your body feeling? Any pain flares, stress, or things going well?"
                  value={customFeeling}
                  onChange={(e) => setCustomFeeling(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground px-1">
                  Press Enter to get suggestions, Shift+Enter for new line
                </p>
              </div>
            </div>
          )}

          {/* PHASE: Suggestions */}
          {displayPhase === 'suggestions' && phase === 'suggestions' && !isLoading && (
            <div className="space-y-3">
              {message && (
                <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3">
                  <p className="text-sm leading-snug whitespace-pre-wrap">{message}</p>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    Suggested for you
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

                  <button
                    onClick={() => {
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

          {/* PHASE: Choice */}
          {displayPhase === 'choice' && !isLoading && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3">
                <p className="text-sm leading-snug">
                  {selectedSuggestions.size === 1
                    ? 'Great choice! What would you like to do?'
                    : 'Great choices! How would you like to incorporate these activities?'
                  }
                </p>
              </div>

              <div className="space-y-2">
                {/* Do It Now — only when exactly 1 activity selected */}
                {selectedSuggestions.size === 1 && onDoItNow && (
                  <button
                    onClick={() => {
                      const activityId = Array.from(selectedSuggestions)[0]
                      onDoItNow(activityId)
                    }}
                    className="w-full p-3 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-400 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <Play className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Do It Now</p>
                        <p className="text-xs text-muted-foreground">
                          Add to today and start right away
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    const activityIds = Array.from(selectedSuggestions)
                    if (onAddToToday) {
                      onAddToToday(activityIds)
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
                        Schedule for later today
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    const activityIds = Array.from(selectedSuggestions)
                    if (onFocusForWeek) {
                      onFocusForWeek(activityIds)
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
                        Plan across the next 7 days
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
          {phase === 'feeling' && !isLoading && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleGetPersonalized}
                disabled={!canSubmitFeeling}
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
                  setSelectedCategory(null)
                  setSelectedEmotion(null)
                  setCustomFeeling('')
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
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
