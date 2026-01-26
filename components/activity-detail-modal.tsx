'use client'

import { X, Clock, ExternalLink, Check } from 'lucide-react'
import { Activity, CATEGORIES } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'

interface ActivityDetailModalProps {
  activity: Activity
  isCompleted: boolean
  onClose: () => void
  onComplete: () => void
  onSwap: () => void
}

export function ActivityDetailModal({
  activity,
  isCompleted,
  onClose,
  onComplete,
  onSwap
}: ActivityDetailModalProps) {
  const category = CATEGORIES[activity.category]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl bg-card animate-in slide-in-from-bottom duration-300"
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
        <div className="p-4 space-y-4 pb-[env(safe-area-inset-bottom)]">
          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatDuration(activity.duration)}
            </span>
            <span
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </span>
          </div>

          {/* Description */}
          <div className="rounded-lg bg-muted p-4 text-foreground">
            {activity.description}
          </div>

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

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
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
        </div>
      </div>
    </div>
  )
}
