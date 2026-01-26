/**
 * Building Nick - Activity Definitions
 * All habits and activities available in the app
 */

export type Category = 'mind_body' | 'physical' | 'mindfulness' | 'professional'

export interface Activity {
  id: string
  name: string
  description: string
  category: Category
  duration: number
  quick?: boolean
  instructions: string
  link?: string
  video?: string
  weather_dependent?: boolean
  outdoor?: boolean
  frequency?: string
  pairs_with?: string
  weekday_only?: boolean
}

export interface CategoryInfo {
  id: Category
  name: string
  color: string
  icon: string
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  mind_body: {
    id: 'mind_body',
    name: 'Mind-Body Practice',
    color: '#8B5CF6',
    icon: 'brain'
  },
  physical: {
    id: 'physical',
    name: 'Physical Exercise',
    color: '#10B981',
    icon: 'activity'
  },
  mindfulness: {
    id: 'mindfulness',
    name: 'Mindfulness',
    color: '#06B6D4',
    icon: 'heart'
  },
  professional: {
    id: 'professional',
    name: 'Professional Goals',
    color: '#F59E0B',
    icon: 'briefcase'
  }
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
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Open the Lin Health app</li>
        <li>Navigate to the Education section</li>
        <li>Complete 1 education module (typically 1-2 minutes)</li>
        <li>Reflect briefly on what you learned</li>
      </ol>
    `
  },
  breathing: {
    id: 'breathing',
    name: 'Breathing Exercises',
    description: 'Focused breathing for calm and presence. Activates the parasympathetic nervous system.',
    category: 'mind_body',
    duration: 3,
    quick: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Find a comfortable seated or lying position</li>
        <li>Close your eyes or soften your gaze</li>
        <li>Breathe in slowly through your nose for 4 counts</li>
        <li>Hold gently for 4 counts</li>
        <li>Exhale slowly through your mouth for 6-8 counts</li>
        <li>Repeat for 2-3 minutes</li>
      </ol>
      <p>Focus on making the exhale longer than the inhale. This signals safety to your nervous system.</p>
    `
  },
  external_orienting: {
    id: 'external_orienting',
    name: 'External Orienting',
    description: 'Scan your environment and describe what you see, hear, and feel. Helps ground you in the present moment.',
    category: 'mind_body',
    duration: 3,
    quick: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Look around the room slowly</li>
        <li>Name 5 things you can see (colors, shapes, objects)</li>
        <li>Notice 4 things you can hear</li>
        <li>Feel 3 textures within reach</li>
        <li>Notice 2 things you can smell</li>
        <li>Take one deep breath</li>
      </ol>
      <p>The goal is to engage your senses and anchor yourself in the present environment, signaling safety to your nervous system.</p>
    `
  },
  internal_orienting: {
    id: 'internal_orienting',
    name: 'Internal Orienting',
    description: 'Pendulation between safe and slightly uncomfortable body awareness. Builds capacity for interoception.',
    category: 'mind_body',
    duration: 5,
    quick: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Sit or lie comfortably</li>
        <li>Scan your body for a place that feels neutral or pleasant (hands, feet, belly)</li>
        <li>Rest your attention there for 30 seconds</li>
        <li>Gently notice an area with mild tension or discomfort</li>
        <li>Stay with it briefly (10-15 seconds), then return to the safe spot</li>
        <li>Pendulate back and forth 3-4 times</li>
      </ol>
      <p>This teaches your nervous system that discomfort is temporary and you can always return to safety.</p>
    `
  },
  visualize_movement: {
    id: 'visualize_movement',
    name: 'Visualize Graded Movement',
    description: 'Mental rehearsal of gradual movement progression. Research shows visualization activates similar neural pathways as actual movement.',
    category: 'mind_body',
    duration: 5,
    quick: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Close your eyes and relax</li>
        <li>Choose a movement you'd like to improve (bending, reaching, walking)</li>
        <li>Visualize yourself performing an easy version of this movement</li>
        <li>Notice how it feels smooth, comfortable, and safe</li>
        <li>Gradually visualize slightly larger ranges of motion</li>
        <li>Always end with a version that feels achievable and safe</li>
      </ol>
      <p>Visualization primes the motor system and can reduce fear of movement.</p>
    `
  },

  // Mind-Body Longer (15+ min)
  movement_coach: {
    id: 'movement_coach',
    name: 'Movement Coach Exercise',
    description: "Guided exercise from \"A Guide to Better Movement\" using Claude's Movement Coach project.",
    category: 'mind_body',
    duration: 15,
    quick: false,
    link: 'https://claude.ai/project/019b66b5-b909-7456-a083-12965209e207',
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Open the Movement Coach project link</li>
        <li>Describe your current state and any areas of focus</li>
        <li>Follow the guided movement exercise provided</li>
        <li>Move slowly and mindfully, never pushing through pain</li>
        <li>Notice any changes in sensation before and after</li>
      </ol>
      <p>The Movement Coach will guide you through exercises based on principles from Todd Hargrove's "A Guide to Better Movement."</p>
    `
  },
  expressive_writing: {
    id: 'expressive_writing',
    name: 'Expressive Writing',
    description: 'Unsent letter or emotionally expressive writing. Research shows this can reduce stress and improve physical health.',
    category: 'mind_body',
    duration: 20,
    quick: false,
    link: 'https://claude.ai/public/artifacts/363274fe-da43-413b-869e-fdc43921d46f',
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Open the Expressive Writing artifact</li>
        <li>Choose a topic: something stressful, a relationship, unexpressed feelings</li>
        <li>Write continuously for 15-20 minutes</li>
        <li>Don't worry about grammar or structure</li>
        <li>Let emotions flow onto the page</li>
        <li>You can delete/discard when done—the value is in the writing, not keeping it</li>
      </ol>
      <p>This practice helps process emotions and has been shown to reduce chronic pain and stress.</p>
    `
  },

  // Physical Exercise
  biking: {
    id: 'biking',
    name: 'Stationary Biking',
    description: "Indoor cycling session. Low-impact cardio that's easy on joints.",
    category: 'physical',
    duration: 20,
    weather_dependent: false,
    frequency: 'every_2_3_days',
    pairs_with: 'dumbbell_presses',
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Set up the stationary bike with proper seat height</li>
        <li>Start with 2-3 minutes of easy warm-up pedaling</li>
        <li>Increase to moderate intensity (you can talk but it's challenging)</li>
        <li>Maintain for 15 minutes</li>
        <li>Cool down with 2-3 minutes of easy pedaling</li>
      </ol>
      <p>Pair this with dumbbell presses for a complete workout. Listen to music or a podcast to make it enjoyable.</p>
    `
  },
  dumbbell_presses: {
    id: 'dumbbell_presses',
    name: 'Dumbbell Presses',
    description: 'Upper body strength training. Builds functional strength for daily activities.',
    category: 'physical',
    duration: 10,
    weather_dependent: false,
    frequency: 'every_2_3_days',
    pairs_with: 'biking',
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Choose a weight that allows 10-12 reps with good form</li>
        <li>Perform 3 sets of chest presses (lying on bench or floor)</li>
        <li>Rest 60-90 seconds between sets</li>
        <li>Optional: Add shoulder presses or rows if time permits</li>
      </ol>
      <p>Focus on controlled movements. Quality over quantity. Stop if you feel pain (not just effort).</p>
    `
  },
  run: {
    id: 'run',
    name: 'Run',
    description: 'Outdoor running session. Great for cardio, mood, and getting outside.',
    category: 'physical',
    duration: 30,
    weather_dependent: true,
    outdoor: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Warm up with 5 minutes of brisk walking</li>
        <li>Run at a conversational pace (you can still talk)</li>
        <li>Alternate running and walking as needed</li>
        <li>Cool down with 5 minutes of walking</li>
        <li>Stretch major muscle groups afterward</li>
      </ol>
      <p>Don't worry about pace or distance. The goal is enjoyment and consistency.</p>
    `
  },
  green_lake_walk: {
    id: 'green_lake_walk',
    name: 'Walk around Green Lake',
    description: 'Scenic walk around Green Lake. About 2.8 miles, mostly flat path.',
    category: 'physical',
    duration: 45,
    weather_dependent: true,
    outdoor: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Drive or bike to Green Lake</li>
        <li>Start at any point on the loop</li>
        <li>Walk at a comfortable pace</li>
        <li>Notice the water, trees, and people around you</li>
        <li>Complete the full loop (about 2.8 miles)</li>
      </ol>
      <p>This is as much about mental refreshment as physical exercise. Leave your phone in your pocket and be present.</p>
    `
  },
  neighborhood_walk: {
    id: 'neighborhood_walk',
    name: 'Neighborhood Walk',
    description: 'Walk around the neighborhood. Simple, accessible, and effective.',
    category: 'physical',
    duration: 30,
    weather_dependent: true,
    outdoor: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Put on comfortable shoes</li>
        <li>Step outside and pick a direction</li>
        <li>Walk at a comfortable pace for 15 minutes</li>
        <li>Turn around and walk back</li>
        <li>Notice your surroundings—houses, plants, sky</li>
      </ol>
      <p>No destination needed. The walk itself is the point.</p>
    `
  },

  // Mindfulness
  lin_health_activity: {
    id: 'lin_health_activity',
    name: 'Lin Health Activity',
    description: 'Complete 1 activity in the Lin Health app. Could be a body scan, breathing exercise, or movement.',
    category: 'mindfulness',
    duration: 2,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Open the Lin Health app</li>
        <li>Check your daily recommended activities</li>
        <li>Choose one activity to complete</li>
        <li>Follow the guided instructions in the app</li>
      </ol>
      <p>Consistency matters more than perfection. Even 2 minutes counts.</p>
    `
  },

  // Professional (weekdays only, skip holidays)
  coursera_module: {
    id: 'coursera_module',
    name: 'Coursera Modules',
    description: 'Complete at least 2 modules from the Digital Product Management course.',
    category: 'professional',
    duration: 20,
    weekday_only: true,
    link: 'https://www.coursera.org/learn/uva-darden-digital-product-management/home/welcome',
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Open the Coursera course link</li>
        <li>Continue where you left off</li>
        <li>Complete at least 2 modules (videos, readings, or quizzes)</li>
        <li>Take brief notes on key concepts</li>
      </ol>
      <p>Progress over perfection. Even partial completion moves you forward.</p>
    `
  },
  job_followup: {
    id: 'job_followup',
    name: 'Job Application Follow-up',
    description: 'Carry out necessary follow-up on existing job applications.',
    category: 'professional',
    duration: 15,
    weekday_only: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Review your job application tracker</li>
        <li>Identify applications that need follow-up (1-2 weeks since applying)</li>
        <li>Send brief, professional follow-up emails</li>
        <li>Update your tracker with any responses or status changes</li>
        <li>Research the companies you've applied to</li>
      </ol>
      <p>Follow-up shows genuine interest and keeps you top of mind.</p>
    `
  },
  job_search: {
    id: 'job_search',
    name: 'Job Search / New Application',
    description: 'Scan for new job openings and/or submit a new application.',
    category: 'professional',
    duration: 20,
    weekday_only: true,
    instructions: `
      <h4>Instructions</h4>
      <ol>
        <li>Check your preferred job boards (LinkedIn, Indeed, company sites)</li>
        <li>Save 2-3 promising positions</li>
        <li>Tailor your resume for one position</li>
        <li>Write or customize a cover letter</li>
        <li>Submit the application</li>
        <li>Add to your tracking spreadsheet</li>
      </ol>
      <p>Quality over quantity. One thoughtful application beats five generic ones.</p>
    `
  }
}

// Helper functions
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

export function getAllActivities(): Activity[] {
  return Object.values(ACTIVITIES)
}
