'use client'

import { useState, useEffect, useMemo } from 'react'
import { Check, ChevronRight, ChevronLeft, Dumbbell, Briefcase, Brain, Sparkles, Search, ArrowUpDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { 
  ACTIVITIES, 
  CATEGORIES,
  getQuickMindBodyActivities
} from '@/lib/activities'
import { useStorage, DailySchedule } from '@/hooks/use-storage'
import { formatDateISO, addDays, isWeekday, getShortDayName, getDayNumber } from '@/lib/date-utils'

interface PlanWeekViewProps {
  onComplete: () => void
  onBack: () => void
}

type TimeBlock = 'before9am' | 'beforeNoon' | 'anytime'
type SortOption = 'name' | 'duration'

// Preset schedules for common patterns
const PRESETS = {
  biking_weights: {
    id: 'biking_weights',
    name: 'Biking + Weights',
    description: '2-3x per week, paired together',
    activities: ['biking', 'dumbbell_presses'],
    frequency: 'every_2_3_days' as const,
    icon: Dumbbell
  },
  professional: {
    id: 'professional',
    name: 'Job Search + Coursera',
    description: 'Every weekday',
    activities: ['coursera_module', 'job_followup', 'job_search'],
    frequency: 'weekdays' as const,
    icon: Briefcase
  },
  mindfulness: {
    id: 'mindfulness',
    name: 'Lin Health Daily',
    description: 'Every day',
    activities: ['lin_health_activity'],
    frequency: 'daily' as const,
    icon: Brain
  }
}

export function PlanWeekView({ onComplete, onBack }: PlanWeekViewProps) {
  const storage = useStorage()
  const [selectedMindBody, setSelectedMindBody] = useState<string>('breathing')
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set(['professional', 'mindfulness']))
  const [step, setStep] = useState<'mind_body' | 'presets' | 'preview' | 'done'>('mind_body')
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [generatedSchedules, setGeneratedSchedules] = useState<Record<string, DailySchedule>>({})
  
  // Search and sort for mind-body selection
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  
  // Get mind-body activities from the activities data
  const mindBodyActivities = useMemo(() => {
    return getQuickMindBodyActivities()
  }, [])
  
  // Filter and sort mind-body activities
  const filteredMindBodyActivities = useMemo(() => {
    let activities = [...mindBodyActivities]
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      activities = activities.filter(a => 
        a.name.toLowerCase().includes(query) || 
        a.description.toLowerCase().includes(query)
      )
    }
    
    // Sort
    activities.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else {
        return a.duration - b.duration
      }
    })
    
    return activities
  }, [mindBodyActivities, searchQuery, sortBy])

  // Generate week dates starting from today
  useEffect(() => {
    const dates: Date[] = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(today, i))
    }
    setWeekDates(dates)
  }, [])

  const togglePreset = (presetId: string) => {
    setSelectedPresets(prev => {
      const next = new Set(prev)
      if (next.has(presetId)) {
        next.delete(presetId)
      } else {
        if (next.size < 3) {
          next.add(presetId)
        }
      }
      return next
    })
  }

  // Generate schedules based on selected mind-body focus and presets
  const generateSchedules = () => {
    const schedules: Record<string, DailySchedule> = {}
    
    // Track which days have biking/weights (for 2-3x per week)
    let lastWorkoutDay = -2 // Start so first day can have workout

    weekDates.forEach((date, index) => {
      const dateStr = formatDateISO(date)
      const isWeekdayDate = isWeekday(date)
      
      const schedule: DailySchedule = {
        date: dateStr,
        activities: {
          before9am: [],
          beforeNoon: [],
          anytime: []
        }
      }

      // Before 9am: Always the selected mind-body focus activity
      schedule.activities.before9am.push(selectedMindBody)
      
      // Also add stretching as a light physical morning activity
      schedule.activities.before9am.push('stretching')

      // Add activities based on selected presets
      selectedPresets.forEach(presetId => {
        const preset = PRESETS[presetId as keyof typeof PRESETS]
        if (!preset) return

        if (preset.frequency === 'weekdays' && isWeekdayDate) {
          // Professional activities on weekdays - moved to appropriate time blocks
          if (preset.activities.includes('coursera_module')) {
            schedule.activities.beforeNoon.push('coursera_module')
          }
          if (preset.activities.includes('job_search')) {
            schedule.activities.anytime.push('job_search')
          }
          if (preset.activities.includes('job_followup')) {
            schedule.activities.anytime.push('job_followup')
          }
        } else if (preset.frequency === 'daily') {
          // Daily activities
          preset.activities.forEach(actId => {
            schedule.activities.anytime.push(actId)
          })
        } else if (preset.frequency === 'every_2_3_days') {
          // Biking + weights: schedule every 2-3 days
          const daysSinceLastWorkout = index - lastWorkoutDay
          if (daysSinceLastWorkout >= 2) {
            preset.activities.forEach(actId => {
              schedule.activities.beforeNoon.push(actId)
            })
            lastWorkoutDay = index
          }
        }
      })

      schedules[dateStr] = schedule
    })

    setGeneratedSchedules(schedules)
    setStep('preview')
  }

  // Save all generated schedules
  const saveSchedules = async () => {
    if (!storage.isReady) return

    for (const schedule of Object.values(generatedSchedules)) {
      await storage.saveDailySchedule(schedule)
    }

    setStep('done')
    setTimeout(() => {
      onComplete()
    }, 1500)
  }

  // Count activities per day for preview
  const getActivityCount = (dateStr: string) => {
    const schedule = generatedSchedules[dateStr]
    if (!schedule) return 0
    return Object.values(schedule.activities).flat().length
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--success)] flex items-center justify-center">
          <Check className="h-8 w-8 text-[var(--success-foreground)]" />
        </div>
        <h2 className="text-xl font-semibold">Week Planned!</h2>
        <p className="text-muted-foreground text-center">
          Your next 7 days are ready. Let's build consistency.
        </p>
      </div>
    )
  }

  // Step 1: Mind-Body Selection
  if (step === 'mind_body') {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Step 1 of 2</span>
          </div>
          <h2 className="text-xl font-semibold">Morning Mind-Body Focus</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Choose which mind-body exercise to practice each morning this week
          </p>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortBy(prev => prev === 'name' ? 'duration' : 'name')}
            className="shrink-0 bg-transparent"
            title={`Sort by ${sortBy === 'name' ? 'duration' : 'name'}`}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Sorted by: {sortBy === 'name' ? 'Name (A-Z)' : 'Duration (shortest first)'}
        </div>

        {/* Mind-body options with accordion */}
        <Accordion 
          type="single" 
          collapsible 
          className="space-y-2"
          value={selectedMindBody}
          onValueChange={(value) => {
            if (value) setSelectedMindBody(value)
          }}
        >
          {filteredMindBodyActivities.map(activity => {
            const isSelected = selectedMindBody === activity.id
            const categoryColor = CATEGORIES[activity.category].color
            
            return (
              <AccordionItem 
                key={activity.id} 
                value={activity.id}
                className={cn(
                  'rounded-xl border px-4 transition-all',
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{activity.name}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{activity.duration} min</span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-4">
                  <div className="pl-12 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                    <div 
                      className="prose prose-sm max-w-none text-muted-foreground [&_h4]:text-xs [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-muted-foreground [&_h4]:font-semibold [&_h4]:mb-2 [&_ol]:pl-5 [&_li]:mb-1.5 [&_p]:mt-2 [&_p]:text-sm"
                      dangerouslySetInnerHTML={{ __html: activity.instructions }}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        {filteredMindBodyActivities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No activities match your search
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 bg-transparent"
            onClick={onBack}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => setStep('presets')}
            disabled={!selectedMindBody}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // Step 2: Presets Selection
  if (step === 'presets') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Step 2 of 2</span>
          </div>
          <h2 className="text-xl font-semibold">Weekly Focus Areas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Select up to 3 additional focus areas for the week
          </p>
        </div>

        {/* Preset options */}
        <div className="space-y-3">
          {Object.values(PRESETS).map(preset => {
            const isSelected = selectedPresets.has(preset.id)
            const Icon = preset.icon
            
            return (
              <button
                key={preset.id}
                onClick={() => togglePreset(preset.id)}
                className={cn(
                  'w-full p-4 rounded-xl border text-left transition-all',
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{preset.name}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {preset.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {preset.activities.map(actId => {
                        const activity = ACTIVITIES[actId]
                        if (!activity) return null
                        return (
                          <span
                            key={actId}
                            className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {activity.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="text-sm text-muted-foreground text-center">
          {selectedPresets.size}/3 selected
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-transparent"
            onClick={() => setStep('mind_body')}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={generateSchedules}
            disabled={selectedPresets.size === 0}
          >
            Preview Week
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Preview Your Week</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Here's what your next 7 days will look like
          </p>
        </div>

        {/* Week preview grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map(date => {
            const dateStr = formatDateISO(date)
            const activityCount = getActivityCount(dateStr)
            const schedule = generatedSchedules[dateStr]
            
            return (
              <div
                key={dateStr}
                className="flex flex-col items-center p-2 rounded-xl bg-card border"
              >
                <span className="text-xs text-muted-foreground">
                  {getShortDayName(date)}
                </span>
                <span className="text-lg font-bold">
                  {getDayNumber(date)}
                </span>
                <span className="text-xs text-primary font-medium mt-1">
                  {activityCount} items
                </span>
              </div>
            )
          })}
        </div>

        {/* Detailed preview */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {weekDates.map(date => {
            const dateStr = formatDateISO(date)
            const schedule = generatedSchedules[dateStr]
            if (!schedule) return null

            const allActivities = Object.values(schedule.activities).flat()
            
            return (
              <div key={dateStr} className="p-3 rounded-xl bg-card border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {getShortDayName(date)} {getDayNumber(date)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {allActivities.length} activities
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {allActivities.map(actId => {
                    const activity = ACTIVITIES[actId]
                    if (!activity) return null
                    const categoryColor = CATEGORIES[activity.category].color
                    
                    return (
                      <span
                        key={actId}
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ 
                          backgroundColor: `${categoryColor}20`,
                          color: categoryColor
                        }}
                      >
                        {activity.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-transparent"
            onClick={() => setStep('presets')}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={saveSchedules}
          >
            Save Plan
          </Button>
        </div>
      </div>
    )
  }

  // Fallback - should not reach here
  return null
}
