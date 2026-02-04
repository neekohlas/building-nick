'use client'

import { useState, useEffect } from 'react'
import { X, Clock, ExternalLink, Check, CalendarClock, Trash2, Play, Volume2, ChevronDown, ChevronUp } from 'lucide-react'
import { Activity, CATEGORIES } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { AudioInstructionsOverlay } from '@/components/audio-instructions-overlay'
import { SpectrumBar } from '@/components/spectrum-bar'
import { LessonCards } from '@/components/lesson-cards'
import { hasMultipleSteps } from '@/hooks/use-audio-instructions'

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Extract Vimeo video ID and optional privacy hash
// Handles: vimeo.com/123456789 and vimeo.com/123456789/abc123hash (unlisted)
function getVimeoEmbedUrl(url: string): string | null {
  // Match vimeo.com/VIDEO_ID or vimeo.com/VIDEO_ID/HASH
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/)
  if (!match) return null

  const videoId = match[1]
  const hash = match[2]

  // For unlisted videos, include the hash parameter
  if (hash) {
    return `https://player.vimeo.com/video/${videoId}?h=${hash}`
  }
  return `https://player.vimeo.com/video/${videoId}`
}

// Check if URL is a Vimeo video (for conditional rendering)
function isVimeoUrl(url: string): boolean {
  return /vimeo\.com\/\d+/.test(url)
}

interface ActivityDetailModalProps {
  activity: Activity
  isCompleted: boolean
  onClose: () => void
  onComplete: () => void
  onSwap: () => void
  onPush?: () => void
  onRemove?: () => void
}

export function ActivityDetailModal({
  activity,
  isCompleted,
  onClose,
  onComplete,
  onSwap,
  onPush,
  onRemove
}: ActivityDetailModalProps) {
  const [showAudioMode, setShowAudioMode] = useState(false)
  const [showAudioButton, setShowAudioButton] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const category = CATEGORIES[activity.category]

  // Check for multi-step instructions on client side only
  // Don't show audio button if activity has tool_card or intro_card lessons (self-contained visual guides)
  useEffect(() => {
    const hasToolCards = activity.lessons?.some(l => l.type === 'tool_card' || l.type === 'intro_card')
    setShowAudioButton(!hasToolCards && hasMultipleSteps(activity.instructions))
  }, [activity.instructions, activity.lessons])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[75dvh] overflow-hidden rounded-xl bg-card animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spectrum bar at top */}
        {activity.spectrum && (
          <SpectrumBar spectrum={activity.spectrum} size="md" />
        )}

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4">
          <h2 className="text-lg font-semibold">{activity.name}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatDuration(activity.duration)}
            </span>
            <span className="text-xs text-muted-foreground">
              {category.name}
            </span>
          </div>

          {/* Audio Mode Button - prominent position for activities with steps */}
          {showAudioButton && (
            <Button
              variant="default"
              size="lg"
              className="w-full"
              onClick={() => setShowAudioMode(true)}
            >
              <Volume2 className="h-5 w-5 mr-2" />
              Start Audio Guide
            </Button>
          )}

          {/* Tool Cards - show prominently for activities with tool_card/intro_card lessons */}
          {activity.lessons?.some(l => l.type === 'tool_card' || l.type === 'intro_card') && (
            <div className="mb-4">
              <LessonCards
                lessons={activity.lessons}
                activityId={activity.id}
                claudePrompt={activity.claudePrompt}
              />
            </div>
          )}

          {/* Description with expandable details */}
          <div className="rounded-lg bg-muted p-3 text-foreground text-sm">
            <p className={showDetails ? '' : 'line-clamp-2'}>{activity.description}</p>

            {/* Expandable instructions */}
            {showDetails && (
              <div className="mt-3 pt-3 border-t border-border/50">
                {/* Lesson Cards - swipeable carousel for multi-video/guide activities (non-tool_card) */}
                {activity.lessons && activity.lessons.length > 0 && !activity.lessons.some(l => l.type === 'tool_card' || l.type === 'intro_card') && (
                  <div className="mb-4">
                    <LessonCards
                      lessons={activity.lessons}
                      activityId={activity.id}
                      claudePrompt={activity.claudePrompt}
                    />
                  </div>
                )}

                {/* Video Preview - only show if no lessons (legacy single video) */}
                {activity.video && (!activity.lessons || activity.lessons.length === 0) && (
                  <div className="space-y-2 mb-3">
                    {/* YouTube - click to open fullscreen */}
                    {getYouTubeVideoId(activity.video) && (
                      <a
                        href={activity.video}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-full aspect-video rounded-lg overflow-hidden bg-background block group"
                      >
                        <img
                          src={`https://img.youtube.com/vi/${getYouTubeVideoId(activity.video)}/hqdefault.jpg`}
                          alt={`${activity.name} video thumbnail`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                            <Play className="h-8 w-8 text-white ml-1" fill="white" />
                          </div>
                        </div>
                      </a>
                    )}
                    {/* Vimeo - click to open fullscreen */}
                    {isVimeoUrl(activity.video) && (
                      <a
                        href={activity.video}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted block group"
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-[#1ab7ea] flex items-center justify-center">
                            <Play className="h-8 w-8 text-white ml-1" fill="white" />
                          </div>
                        </div>
                        <span className="absolute bottom-2 left-2 text-xs text-white/80">Click to play on Vimeo</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Link */}
                {activity.link && (
                  <a
                    href={activity.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary text-xs font-medium hover:underline mb-3"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Resource
                  </a>
                )}

                {/* Instructions */}
                {activity.instructions && (
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground [&_h4]:text-xs [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-muted-foreground [&_h4]:font-semibold [&_h4]:mb-2 [&_ol]:pl-4 [&_ol]:text-xs [&_li]:mb-1.5 [&_p]:mt-2 [&_p]:text-xs"
                    dangerouslySetInnerHTML={{ __html: activity.instructions }}
                  />
                )}
              </div>
            )}

            {/* Show more/less toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex flex-col gap-3 p-4 border-t bg-card shrink-0">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={onSwap}
            >
              Swap Activity
            </Button>
            <Button
              className="flex-1"
              onClick={onComplete}
              disabled={isCompleted}
            >
              {isCompleted ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Completed
                </>
              ) : (
                'Mark Complete'
              )}
            </Button>
          </div>
          {onPush && !isCompleted && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onPush}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Push to Tomorrow
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Audio Instructions Overlay */}
      {showAudioMode && (
        <AudioInstructionsOverlay
          instructions={activity.instructions}
          activityName={activity.name}
          onClose={() => setShowAudioMode(false)}
        />
      )}
    </div>
  )
}
