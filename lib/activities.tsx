/**
 * Building Nick - Activity Definitions
 * All habits and activities available in the app
 */

export type Category = 'mind_body' | 'physical' | 'professional'
export type Frequency = 'daily' | 'weekdays' | 'every_2_3_days' | 'weekly' | 'as_needed'
export type TimeBlock = 'before6am' | 'before9am' | 'before12pm' | 'before3pm' | 'before5pm' | 'before6pm' | 'before9pm' | 'before12am' | 'beforeNoon' | 'before230pm'
export type DayType = 'heavy' | 'light' | 'both'

// Mind-body spectrum: 1 = emotional/cognitive, 3 = mind-focused, 5 = movement-based
// Used for visual gradient indicator on activity cards
export type MindBodyType = 1 | 2 | 3 | 4 | 5

// Colors for mind-body spectrum gradient (warm to cool)
export const MIND_BODY_COLORS: Record<MindBodyType, string> = {
  1: '#F59E0B', // Amber - emotional/writing
  2: '#A855F7', // Purple - mind-based with some emotion
  3: '#8B5CF6', // Violet - balanced mind-body (default)
  4: '#6366F1', // Indigo - movement with mind focus
  5: '#14B8A6', // Teal - primarily physical movement
}

// New types for week planning flow
export type PlanFrequency = 'heavy' | 'light' | 'everyday' | 'weekdays' | 'weekends' | 'custom'

export interface ActivitySelection {
  activityId: string
  frequency: PlanFrequency
  variantId?: string  // If user picked a specific variant
  customDays?: string[]  // ISO date strings for custom frequency (e.g., ['2024-01-15', '2024-01-17'])
}

// Heart-Mind-Body spectrum scores (0-1 each axis)
// Used for triangular radar visualization
export interface SpectrumScores {
  heart: number  // Emotional/relational (journaling, gratitude, connection)
  mind: number   // Cognitive/focus (education, meditation, planning)
  body: number   // Movement/physical (exercises, stretches, outdoor)
}

export interface Activity {
  id: string
  name: string
  description: string
  category: Category
  duration: number
  quick?: boolean
  instructions: string
  link?: string
  video?: string              // Video URL for guided activities
  frequency?: Frequency
  weekdayOnly?: boolean
  weatherDependent?: boolean
  outdoor?: boolean
  pairsWith?: string
  defaultTimeBlock?: TimeBlock  // Default time of day for this activity
  dayType?: DayType            // Whether activity is for heavy days, light days, or both
  favorite?: boolean           // User-marked favorite activities (synced from Notion)
  sortOrder?: number           // Custom sort order from Notion (lower numbers appear first)
  // Mind-body spectrum for visual indicator (1=emotional, 3=mind, 5=movement)
  mindBodyType?: MindBodyType  // Only used for mind_body category activities
  // Heart-Mind-Body triangular spectrum (0-1 for each axis)
  spectrum?: SpectrumScores    // New triangular radar visualization
  // Generic activity support
  isGeneric?: boolean           // true for parent activities like 'run', 'walk'
  variants?: string[]           // e.g., ['run_green_lake', 'run_neighborhood']
  parentActivityId?: string     // e.g., 'run' for run_green_lake
}

export const ACTIVITIES: Record<string, Activity> = {
  // Mind-Body Quick (1-5 min)
  lin_health_education: {
    id: 'lin_health_education',
    name: 'Lin Health Education',
    description: 'Chronic Pain Science Education module from the Lin Health app.',
    category: 'mind_body',
    duration: 2,
    quick: true,
    mindBodyType: 2, // Mind-based with some emotional content
    instructions: `<h4>Instructions</h4>
<ol>
<li>Open the Lin Health app</li>
<li>Navigate to the Education section</li>
<li>Complete 1 education module (typically 1-2 minutes)</li>
<li>Reflect briefly on what you learned</li>
</ol>`
  },
  breathing: {
    id: 'breathing',
    name: 'Breathing Exercises',
    description: 'Focused breathing for calm and presence. Activates the parasympathetic nervous system.',
    category: 'mind_body',
    duration: 3,
    quick: true,
    mindBodyType: 3, // Balanced mind-body
    instructions: `<h4>Instructions</h4>
<ol>
<li>Find a comfortable seated or lying position</li>
<li>Close your eyes or soften your gaze</li>
<li>Breathe in slowly through your nose for 4 counts</li>
<li>Hold gently for 4 counts</li>
<li>Exhale slowly through your mouth for 6-8 counts</li>
<li>Repeat for 2-3 minutes</li>
</ol>
<p>Focus on making the exhale longer than the inhale. This signals safety to your nervous system.</p>`
  },
  external_orienting: {
    id: 'external_orienting',
    name: 'External Orienting',
    description: 'Scan your environment and describe what you see, hear, and feel.',
    category: 'mind_body',
    duration: 3,
    quick: true,
    mindBodyType: 2, // Mind-based sensory awareness
    instructions: `<h4>Instructions</h4>
<ol>
<li>Look around the room slowly</li>
<li>Name 5 things you can see (colors, shapes, objects)</li>
<li>Notice 4 things you can hear</li>
<li>Feel 3 textures within reach</li>
<li>Notice 2 things you can smell</li>
<li>Take one deep breath</li>
</ol>
<p>The goal is to engage your senses and anchor yourself in the present environment.</p>`
  },
  internal_orienting: {
    id: 'internal_orienting',
    name: 'Internal Orienting',
    description: 'Pendulation between safe and slightly uncomfortable body awareness.',
    category: 'mind_body',
    duration: 5,
    quick: true,
    mindBodyType: 3, // Body awareness (mind-body balanced)
    instructions: `<h4>Instructions</h4>
<ol>
<li>Sit or lie comfortably</li>
<li>Scan your body for a place that feels neutral or pleasant</li>
<li>Rest your attention there for 30 seconds</li>
<li>Gently notice an area with mild tension or discomfort</li>
<li>Stay with it briefly (10-15 seconds), then return to the safe spot</li>
<li>Pendulate back and forth 3-4 times</li>
</ol>
<p>This teaches your nervous system that discomfort is temporary.</p>`
  },
  visualize_movement: {
    id: 'visualize_movement',
    name: 'Visualize Graded Movement',
    description: 'Mental rehearsal of gradual movement progression.',
    category: 'mind_body',
    duration: 5,
    quick: true,
    mindBodyType: 4, // Movement-focused but still mental
    instructions: `<h4>Instructions</h4>
<ol>
<li>Close your eyes and relax</li>
<li>Choose a movement you'd like to improve (bending, reaching, walking)</li>
<li>Visualize yourself performing an easy version of this movement</li>
<li>Notice how it feels smooth, comfortable, and safe</li>
<li>Gradually visualize slightly larger ranges of motion</li>
<li>Always end with a version that feels achievable and safe</li>
</ol>
<p>Visualization primes the motor system and can reduce fear of movement.</p>`
  },

  // Mind-Body Longer (15+ min)
  movement_coach: {
    id: 'movement_coach',
    name: 'Movement Coach Exercise',
    description: 'Guided exercise from "A Guide to Better Movement" using Claude\'s Movement Coach.',
    category: 'mind_body',
    duration: 15,
    quick: false,
    mindBodyType: 5, // Movement-based
    link: 'https://claude.ai/project/019b66b5-b909-7456-a083-12965209e207',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Open the Movement Coach project link</li>
<li>Describe your current state and any areas of focus</li>
<li>Follow the guided movement exercise provided</li>
<li>Move slowly and mindfully, never pushing through pain</li>
<li>Notice any changes in sensation before and after</li>
</ol>
<p>The Movement Coach will guide you through exercises based on Todd Hargrove's principles.</p>`
  },
  expressive_writing: {
    id: 'expressive_writing',
    name: 'Expressive Writing',
    description: 'Unsent letter or emotionally expressive writing to process feelings.',
    category: 'mind_body',
    duration: 20,
    quick: false,
    mindBodyType: 1, // Emotional processing
    link: 'https://claude.ai/public/artifacts/363274fe-da43-413b-869e-fdc43921d46f',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Open the Expressive Writing artifact</li>
<li>Choose a topic: something stressful, a relationship, unexpressed feelings</li>
<li>Write continuously for 15-20 minutes</li>
<li>Don't worry about grammar or structure</li>
<li>Let emotions flow onto the page</li>
<li>You can delete/discard when done</li>
</ol>
<p>This practice helps process emotions and has been shown to reduce chronic pain.</p>`
  },

  // Physical Exercise
  biking: {
    id: 'biking',
    name: 'Stationary Biking',
    description: 'Indoor cycling session. Low-impact cardio that\'s easy on joints.',
    category: 'physical',
    duration: 20,
    weatherDependent: false,
    frequency: 'every_2_3_days',
    pairsWith: 'dumbbell_presses',
    defaultTimeBlock: 'before9am',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Set up the stationary bike with proper seat height</li>
<li>Start with 2-3 minutes of easy warm-up pedaling</li>
<li>Increase to moderate intensity</li>
<li>Maintain for 15 minutes</li>
<li>Cool down with 2-3 minutes of easy pedaling</li>
</ol>
<p>Pair this with dumbbell presses for a complete workout.</p>`
  },
  dumbbell_presses: {
    id: 'dumbbell_presses',
    name: 'Dumbbell Presses',
    description: 'Upper body strength training for functional strength.',
    category: 'physical',
    duration: 10,
    weatherDependent: false,
    frequency: 'every_2_3_days',
    pairsWith: 'biking',
    defaultTimeBlock: 'before9am',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Choose a weight that allows 10-12 reps with good form</li>
<li>Perform 3 sets of chest presses</li>
<li>Rest 60-90 seconds between sets</li>
<li>Optional: Add shoulder presses or rows if time permits</li>
</ol>
<p>Focus on controlled movements. Quality over quantity.</p>`
  },

  // Running - generic parent activity
  run: {
    id: 'run',
    name: 'Running',
    description: 'Running at your preferred location. Choose a specific route or leave flexible.',
    category: 'physical',
    duration: 30,
    weatherDependent: true,
    outdoor: true,
    frequency: 'every_2_3_days',
    defaultTimeBlock: 'before9am',
    isGeneric: true,
    variants: ['run_green_lake', 'run_neighborhood'],
    instructions: `<h4>Instructions</h4>
<ol>
<li>Put on running shoes and step outside</li>
<li>Warm up with 5 minutes of brisk walking</li>
<li>Run at a conversational pace</li>
<li>Alternate running and walking as needed</li>
<li>Cool down with 5 minutes of walking</li>
</ol>
<p>You can swap this to a specific location in Today view.</p>`
  },

  // Running - with location variants
  run_green_lake: {
    id: 'run_green_lake',
    name: 'Run (Green Lake)',
    description: 'Running loop around Green Lake. Scenic path, about 2.8 miles.',
    category: 'physical',
    duration: 30,
    weatherDependent: true,
    outdoor: true,
    defaultTimeBlock: 'before9am',
    parentActivityId: 'run',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Head to Green Lake</li>
<li>Warm up with 5 minutes of brisk walking</li>
<li>Run at a conversational pace around the lake</li>
<li>Alternate running and walking as needed</li>
<li>Cool down with 5 minutes of walking</li>
</ol>
<p>The lake loop is about 2.8 miles. Beautiful scenery makes the run enjoyable.</p>`
  },
  run_neighborhood: {
    id: 'run_neighborhood',
    name: 'Run (Neighborhood)',
    description: 'Running through the neighborhood. Convenient and flexible distance.',
    category: 'physical',
    duration: 30,
    weatherDependent: true,
    outdoor: true,
    defaultTimeBlock: 'before9am',
    parentActivityId: 'run',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Put on running shoes and step outside</li>
<li>Warm up with 5 minutes of brisk walking</li>
<li>Run at a conversational pace</li>
<li>Explore different streets and routes</li>
<li>Cool down with 5 minutes of walking</li>
</ol>
<p>No set route needed. Just run where you feel like going.</p>`
  },

  // Walking - generic parent activity
  walk: {
    id: 'walk',
    name: 'Walking',
    description: 'Walking at your preferred location. Choose a specific route or leave flexible.',
    category: 'physical',
    duration: 30,
    weatherDependent: true,
    outdoor: true,
    frequency: 'every_2_3_days',
    defaultTimeBlock: 'before230pm',
    isGeneric: true,
    variants: ['walk_green_lake', 'walk_neighborhood'],
    instructions: `<h4>Instructions</h4>
<ol>
<li>Put on comfortable shoes</li>
<li>Step outside and pick a direction</li>
<li>Walk at a comfortable pace</li>
<li>Notice your surroundings</li>
<li>Turn around when ready</li>
</ol>
<p>You can swap this to a specific location in Today view.</p>`
  },

  // Walking - with location variants (afternoon default)
  walk_green_lake: {
    id: 'walk_green_lake',
    name: 'Walk (Green Lake)',
    description: 'Scenic walk around Green Lake. About 2.8 miles, mostly flat path.',
    category: 'physical',
    duration: 45,
    weatherDependent: true,
    outdoor: true,
    defaultTimeBlock: 'before230pm',
    parentActivityId: 'walk',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Drive or bike to Green Lake</li>
<li>Start at any point on the loop</li>
<li>Walk at a comfortable pace</li>
<li>Notice the water, trees, and people around you</li>
<li>Complete the full loop (about 2.8 miles)</li>
</ol>
<p>This is as much about mental refreshment as physical exercise.</p>`
  },
  walk_neighborhood: {
    id: 'walk_neighborhood',
    name: 'Walk (Neighborhood)',
    description: 'Walk around the neighborhood. Simple, accessible, and effective.',
    category: 'physical',
    duration: 30,
    weatherDependent: true,
    outdoor: true,
    defaultTimeBlock: 'before230pm',
    parentActivityId: 'walk',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Put on comfortable shoes</li>
<li>Step outside and pick a direction</li>
<li>Walk at a comfortable pace for 15 minutes</li>
<li>Turn around and walk back</li>
<li>Notice your surroundings</li>
</ol>
<p>No destination needed. The walk itself is the point.</p>`
  },

  // Professional (weekdays only)
  coursera_module: {
    id: 'coursera_module',
    name: 'Coursera Modules',
    description: 'Complete at least 2 modules from the Digital Product Management course.',
    category: 'professional',
    duration: 20,
    weekdayOnly: true,
    frequency: 'weekdays',
    link: 'https://www.coursera.org/learn/uva-darden-digital-product-management/home/welcome',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Open the Coursera course link</li>
<li>Continue where you left off</li>
<li>Complete at least 2 modules</li>
<li>Take brief notes on key concepts</li>
</ol>
<p>Progress over perfection. Even partial completion moves you forward.</p>`
  },
  job_followup: {
    id: 'job_followup',
    name: 'Job Application Follow-up',
    description: 'Carry out necessary follow-up on existing job applications.',
    category: 'professional',
    duration: 15,
    weekdayOnly: true,
    frequency: 'weekdays',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Review your job application tracker</li>
<li>Identify applications that need follow-up</li>
<li>Send brief, professional follow-up emails</li>
<li>Update your tracker with any status changes</li>
<li>Research the companies you've applied to</li>
</ol>
<p>Follow-up shows genuine interest and keeps you top of mind.</p>`
  },
  job_search: {
    id: 'job_search',
    name: 'Job Search / New Application',
    description: 'Scan for new job openings and/or submit a new application.',
    category: 'professional',
    duration: 20,
    weekdayOnly: true,
    frequency: 'weekdays',
    instructions: `<h4>Instructions</h4>
<ol>
<li>Check your preferred job boards</li>
<li>Save 2-3 promising positions</li>
<li>Tailor your resume for one position</li>
<li>Write or customize a cover letter</li>
<li>Submit the application</li>
<li>Add to your tracking spreadsheet</li>
</ol>
<p>Quality over quantity. One thoughtful application beats five generic ones.</p>`
  }
}

export const CATEGORIES: Record<Category, { id: Category; name: string; color: string }> = {
  mind_body: {
    id: 'mind_body',
    name: 'Mind-Body Practice',
    color: '#8B5CF6'
  },
  physical: {
    id: 'physical',
    name: 'Physical Exercise',
    color: '#10B981'
  },
  professional: {
    id: 'professional',
    name: 'Professional Goals',
    color: '#F59E0B'
  }
}

// Helper functions
export function getAllActivities(): Activity[] {
  return Object.values(ACTIVITIES)
}

export function getActivitiesByCategory(category: Category): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === category)
}

export function getQuickMindBodyActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === 'mind_body' && a.quick)
}

export function getLongerMindBodyActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === 'mind_body' && !a.quick)
}

export function getPhysicalActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === 'physical')
}

export function getIndoorPhysicalActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === 'physical' && !a.outdoor)
}

export function getOutdoorPhysicalActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === 'physical' && a.outdoor)
}

export function getProfessionalActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.category === 'professional')
}

export function getWeekdayActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.weekdayOnly)
}

export function getEvery2to3DayActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.frequency === 'every_2_3_days')
}

export function getDailyActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.frequency === 'daily')
}

// Get all activities suitable for week planning (excludes quick mind-body and variant activities)
export function getPlanableActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a =>
    // Exclude variants - we show generic parent activities instead
    !a.parentActivityId &&
    (
      // Physical activities with frequency
      (a.category === 'physical' && a.frequency) ||
      // Professional activities (weekday only)
      a.category === 'professional' ||
      // Longer mind-body activities
      (a.category === 'mind_body' && !a.quick)
    )
  )
}

// Get generic activities (activities that have variants)
export function getGenericActivities(): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.isGeneric)
}

// Get variants for a generic activity
export function getVariantsForActivity(activityId: string): Activity[] {
  const activity = ACTIVITIES[activityId]
  if (!activity?.variants) return []
  return activity.variants.map(id => ACTIVITIES[id]).filter(Boolean)
}

// Check if an activity is a variant of a generic activity
export function isVariantActivity(activityId: string): boolean {
  return !!ACTIVITIES[activityId]?.parentActivityId
}

// Get the parent generic activity for a variant
export function getParentActivity(activityId: string): Activity | undefined {
  const activity = ACTIVITIES[activityId]
  if (!activity?.parentActivityId) return undefined
  return ACTIVITIES[activity.parentActivityId]
}

// Get walking activity variants (for location selection)
export function getWalkingActivities(): Activity[] {
  return [
    ACTIVITIES.walk_green_lake,
    ACTIVITIES.walk_neighborhood
  ].filter(Boolean) as Activity[]
}

// Get running activity variants (for location selection)
export function getRunningActivities(): Activity[] {
  return [
    ACTIVITIES.run_green_lake,
    ACTIVITIES.run_neighborhood
  ].filter(Boolean) as Activity[]
}

// Get activities by their default time block
export function getActivitiesByTimeBlock(timeBlock: TimeBlock): Activity[] {
  return Object.values(ACTIVITIES).filter(a => a.defaultTimeBlock === timeBlock)
}

// Get morning activities (before 9am)
export function getMorningActivities(): Activity[] {
  return getActivitiesByTimeBlock('before9am')
}

// Get afternoon activities (before 2:30pm)
export function getAfternoonActivities(): Activity[] {
  return getActivitiesByTimeBlock('before230pm')
}
