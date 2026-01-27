'use client'

import { useState } from 'react'
import { X, Clock, MapPin, ChevronDown, ChevronRight, Check, ArrowRight } from 'lucide-react'
import { Activity, CATEGORIES, Category, getVariantsForActivity } from '@/lib/activities'
import { useActivities } from '@/hooks/use-activities'
import { formatDuration } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SwapModalProps {
  currentActivity: Activity
  onClose: () => void
  onSwap: (newActivityId: string) => void
}

const CATEGORY_ORDER: Category[] = ['physical', 'mind_body', 'professional']

export function SwapModal({ currentActivity, onClose, onSwap }: SwapModalProps) {
  const { getAllActivities, getActivity } = useActivities()

  // Selected activity for preview/confirmation
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)

  // Start with current activity's category expanded
  const [expandedCategories, setExpandedCategories] = useState<Category[]>([currentActivity.category])

  // Check if current activity is generic or has a parent
  const isGeneric = currentActivity.isGeneric
  const parentId = currentActivity.parentActivityId
  const parentActivity = parentId ? getActivity(parentId) : null

  // Get variants if this is a generic activity or its variant
  const variants = isGeneric
    ? getVariantsForActivity(currentActivity.id)
    : parentActivity
      ? getVariantsForActivity(parentActivity.id).filter(v => v.id !== currentActivity.id)
      : []

  // Get IDs to exclude (current activity and its variants/parent)
  const currentVariantIds = new Set(
    isGeneric
      ? [currentActivity.id, ...(currentActivity.variants || [])]
      : parentActivity
        ? [parentActivity.id, ...(parentActivity.variants || [])]
        : [currentActivity.id]
  )

  // Get all activities grouped by category
  const allActivities = getAllActivities()
  const activitiesByCategory: Record<Category, Activity[]> = {
    physical: [],
    mind_body: [],
    professional: []
  }

  allActivities.forEach(activity => {
    // Skip variants, current activity, and its related activities
    if (activity.parentActivityId) return
    if (currentVariantIds.has(activity.id)) return
    if (activity.name === 'Untitled') return

    activitiesByCategory[activity.category].push(activity)
  })

  const toggleCategory = (category: Category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleSelectActivity = (activity: Activity) => {
    // If already selected, deselect
    if (selectedActivity?.id === activity.id) {
      setSelectedActivity(null)
    } else {
      setSelectedActivity(activity)
    }
  }

  const handleConfirmSwap = () => {
    if (selectedActivity) {
      console.log('SwapModal: confirming swap to', selectedActivity.id)
      onSwap(selectedActivity.id)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[70vh] overflow-hidden rounded-2xl bg-card animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card p-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold">Swap Activity</h2>
            <p className="text-xs text-muted-foreground">
              Replace "{currentActivity.name}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options - scrollable area */}
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          {/* Variant options - shown first for generic activities */}
          {variants.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                <MapPin className="h-3 w-3 inline mr-1" />
                Choose Location
              </h3>
              {variants.map((activity) => {
                const category = CATEGORIES[activity.category]
                const isSelected = selectedActivity?.id === activity.id
                return (
                  <button
                    key={activity.id}
                    onClick={() => handleSelectActivity(activity)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                        : 'hover:border-primary hover:bg-primary/5 border-primary/30 bg-primary/5'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{activity.name}</span>
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(activity.duration)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Category sections */}
          {CATEGORY_ORDER.map((category) => {
            const activities = activitiesByCategory[category]
            if (activities.length === 0) return null

            const categoryInfo = CATEGORIES[category]
            const isExpanded = expandedCategories.includes(category)
            const isCurrentCategory = category === currentActivity.category

            return (
              <div key={category} className="space-y-1">
                <button
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors',
                    'hover:bg-muted/50',
                    isCurrentCategory && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: categoryInfo.color }}
                    />
                    <span className="font-medium text-sm">{categoryInfo.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({activities.length})
                    </span>
                  </div>
                  {isCurrentCategory && (
                    <span className="text-xs text-primary font-medium">Current</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-1 pl-2">
                    {activities.map((activity) => {
                      const isSelected = selectedActivity?.id === activity.id
                      return (
                        <button
                          key={activity.id}
                          onClick={() => handleSelectActivity(activity)}
                          className={cn(
                            'w-full text-left rounded-lg border p-3 transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 ring-2 ring-primary'
                              : 'hover:border-primary hover:bg-primary/5'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{activity.name}</span>
                            <div className="flex items-center gap-2">
                              {isSelected && <Check className="h-4 w-4 text-primary" />}
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: categoryInfo.color }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(activity.duration)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {Object.values(activitiesByCategory).every(arr => arr.length === 0) && variants.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No alternative activities available.
            </p>
          )}
        </div>

        {/* Confirm Button - Fixed at bottom */}
        {selectedActivity && (
          <div className="border-t bg-card p-3 shrink-0">
            <Button
              className="w-full"
              onClick={handleConfirmSwap}
            >
              <span className="truncate">{currentActivity.name}</span>
              <ArrowRight className="h-4 w-4 mx-2 shrink-0" />
              <span className="truncate">{selectedActivity.name}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
