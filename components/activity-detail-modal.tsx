'use client'

import { X, Clock, ExternalLink, Check, CalendarClock, Trash2, Play } from 'lucide-react'
import { Activity, CATEGORIES, MIND_BODY_COLORS, MindBodyType } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'

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

// Check if URL is a Vimeo video
function getVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
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
  const category = CATEGORIES[activity.category]

  // Get badge color - for mind_body, use mindBodyType gradient if available
  const getBadgeColor = () => {
    if (activity.category === 'mind_body' && activity.mindBodyType) {
      return MIND_BODY_COLORS[activity.mindBodyType as MindBodyType]
    }
    return category.color
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85dvh] overflow-hidden rounded-2xl bg-card animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatDuration(activity.duration)}
            </span>
            <span
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs"
              style={{ backgroundColor: getBadgeColor() }}
            >
              {category.name}
            </span>
          </div>

          {/* Description */}
          <div className="rounded-lg bg-muted p-4 text-foreground">
            {activity.description}
          </div>

          {/* Video Preview */}
          {activity.video && (
            <div className="space-y-3">
              {/* YouTube embed */}
              {getYouTubeVideoId(activity.video) && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(activity.video)}`}
                    title={`${activity.name} video`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              )}
              {/* Vimeo embed */}
              {getVimeoVideoId(activity.video) && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={`https://player.vimeo.com/video/${getVimeoVideoId(activity.video)}`}
                    title={`${activity.name} video`}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              )}
              {/* Open video button (for all video links including non-embeddable) */}
              <a
                href={activity.video}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary font-medium hover:underline"
              >
                <Play className="h-4 w-4" />
                Open Video
              </a>
            </div>
          )}

          {/* Link */}
          {activity.link && (
            <a
              href={activity.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary font-medium hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Open Resource
            </a>
          )}

          {/* Instructions */}
          <div
            className="prose prose-sm max-w-none text-muted-foreground [&_h4]:text-xs [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-muted-foreground [&_h4]:font-semibold [&_h4]:mb-2 [&_ol]:pl-5 [&_li]:mb-2 [&_p]:mt-3 [&_p]:text-sm"
            dangerouslySetInnerHTML={{ __html: activity.instructions }}
          />
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
    </div>
  )
}
