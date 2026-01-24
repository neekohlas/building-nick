/**
 * Building Nick - Activity Definitions
 * All habits and activities available in the app
 */

const ACTIVITIES = {
  // Mind-Body Quick (1-5 min)
  lin_health_education: {
    id: 'lin_health_education',
    name: 'Lin Health Education',
    description: 'Chronic Pain Science Education module',
    category: 'mind_body',
    duration: 2,
    quick: true
  },
  breathing: {
    id: 'breathing',
    name: 'Breathing Exercises',
    description: 'Focused breathing for calm and presence',
    category: 'mind_body',
    duration: 3,
    quick: true
  },
  external_orienting: {
    id: 'external_orienting',
    name: 'External Orienting',
    description: 'Scan your environment, describe what you see and feel',
    category: 'mind_body',
    duration: 3,
    quick: true
  },
  internal_orienting: {
    id: 'internal_orienting',
    name: 'Internal Orienting',
    description: 'Pendulation between safe and slightly uncomfortable body awareness',
    category: 'mind_body',
    duration: 5,
    quick: true
  },
  visualize_movement: {
    id: 'visualize_movement',
    name: 'Visualize Graded Movement',
    description: 'Mental rehearsal of gradual movement progression',
    category: 'mind_body',
    duration: 5,
    quick: true
  },

  // Mind-Body Longer (15+ min)
  movement_coach: {
    id: 'movement_coach',
    name: 'Movement Coach Exercise',
    description: 'Exercise from A Guide to Better Movement',
    category: 'mind_body',
    duration: 15,
    quick: false,
    link: 'https://claude.ai/project/019b66b5-b909-7456-a083-12965209e207'
  },
  expressive_writing: {
    id: 'expressive_writing',
    name: 'Expressive Writing',
    description: 'Unsent letter or emotionally expressive writing',
    category: 'mind_body',
    duration: 20,
    quick: false,
    link: 'https://claude.ai/public/artifacts/363274fe-da43-413b-869e-fdc43921d46f'
  },

  // Physical Exercise
  biking: {
    id: 'biking',
    name: 'Stationary Biking',
    description: 'Indoor cycling session',
    category: 'physical',
    duration: 20,
    weather_dependent: false,
    frequency: 'every_2_3_days',
    pairs_with: 'dumbbell_presses'
  },
  dumbbell_presses: {
    id: 'dumbbell_presses',
    name: 'Dumbbell Presses',
    description: 'Upper body strength training',
    category: 'physical',
    duration: 10,
    weather_dependent: false,
    frequency: 'every_2_3_days',
    pairs_with: 'biking'
  },
  run: {
    id: 'run',
    name: 'Run',
    description: 'Outdoor running session',
    category: 'physical',
    duration: 30,
    weather_dependent: true,
    outdoor: true
  },
  green_lake_walk: {
    id: 'green_lake_walk',
    name: 'Walk around Green Lake',
    description: 'Scenic walk around Green Lake',
    category: 'physical',
    duration: 45,
    weather_dependent: true,
    outdoor: true
  },
  neighborhood_walk: {
    id: 'neighborhood_walk',
    name: 'Neighborhood Walk',
    description: 'Walk around the neighborhood',
    category: 'physical',
    duration: 30,
    weather_dependent: true,
    outdoor: true
  },

  // Mindfulness
  lin_health_activity: {
    id: 'lin_health_activity',
    name: 'Lin Health Activity',
    description: 'Complete 1 activity in Lin Health app',
    category: 'mindfulness',
    duration: 2
  },

  // Professional (weekdays only, skip holidays)
  coursera_module: {
    id: 'coursera_module',
    name: 'Coursera Modules',
    description: 'Complete at least 2 modules from Digital Product Management course',
    category: 'professional',
    duration: 20,
    weekday_only: true,
    link: 'https://www.coursera.org/learn/uva-darden-digital-product-management/home/welcome'
  },
  job_followup: {
    id: 'job_followup',
    name: 'Job Application Follow-up',
    description: 'Carry out necessary follow-up on job applications',
    category: 'professional',
    duration: 15,
    weekday_only: true
  },
  job_search: {
    id: 'job_search',
    name: 'Job Search / New Application',
    description: 'Scan for new job openings and/or submit new application',
    category: 'professional',
    duration: 20,
    weekday_only: true
  }
};

// Category definitions with display info
const CATEGORIES = {
  mind_body: {
    id: 'mind_body',
    name: 'Mind-Body Practice',
    color: '#8B5CF6', // Purple
    icon: 'brain'
  },
  physical: {
    id: 'physical',
    name: 'Physical Exercise',
    color: '#10B981', // Green
    icon: 'activity'
  },
  mindfulness: {
    id: 'mindfulness',
    name: 'Mindfulness',
    color: '#06B6D4', // Cyan
    icon: 'heart'
  },
  professional: {
    id: 'professional',
    name: 'Professional Goals',
    color: '#F59E0B', // Amber
    icon: 'briefcase'
  }
};

// US Federal Holidays for 2026
const FEDERAL_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth (observed)
  '2026-07-03', // Independence Day (observed - July 4 is Saturday)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25'  // Christmas Day
];

// Positive messaging library
const MESSAGES = {
  morning: [
    "Good morning! You've got a solid plan ready. Let's make today count.",
    "New day, fresh start. Your plan is ready when you are.",
    "Rise and shine! A few focused activities can make all the difference.",
    "Good morning! Small steps, big progress. Let's go.",
    "Today is full of possibility. Your plan is waiting.",
    "Morning! You've shown up, and that's what matters most.",
    "Let's do this. One activity at a time.",
    "Good morning! Your future self will thank you for today.",
    "Ready to build momentum? Your plan is set.",
    "Morning! Consistency beats perfection. Let's get started."
  ],

  completion: [
    "Nice work!",
    "Done! Keep the momentum going.",
    "That's one more in the books.",
    "Crushed it!",
    "You showed up. That's what counts.",
    "Another win for you!",
    "Progress, not perfection.",
    "Way to follow through!",
    "Check! Moving right along.",
    "That's how it's done!"
  ],

  streak: [
    "You're on a {n}-day streak! Keep it rolling.",
    "{n} days strong! Consistency is building.",
    "Day {n} of your streak. You're proving something here.",
    "{n} days in a row. This is what building looks like."
  ],

  reengagement: [
    "Progress is rarely linear. What matters is starting again.",
    "Yesterday is done. Today is fresh. Let's go.",
    "Every expert was once a beginner. Every streak starts with day one.",
    "The best time to start is now. 5-4-3-2-1...",
    "You're here now. That's what counts.",
    "No guilt, no shame. Just one activity to start."
  ],

  countdown: [
    "Don't think, just count down and start. 5-4-3-2-1...",
    "Two minutes is all it takes. 5-4-3-2-1, go!",
    "Overthinking? Stop. 5-4-3-2-1, just begin.",
    "Your brain will thank you once you start. 5-4-3-2-1..."
  ],

  evening: [
    "Tomorrow's looking good! Take a peek at your plan.",
    "Quick check: here's what's on deck for tomorrow.",
    "Ready to set yourself up for success tomorrow?",
    "Evening check-in: tomorrow's plan is ready for you."
  ],

  sunday: [
    "Time to plan your week ahead!",
    "Sunday planning session: set yourself up for a great week.",
    "Ready to map out the week? Your future self will thank you."
  ]
};

// Helper functions for activities
function getActivitiesByCategory(category) {
  return Object.values(ACTIVITIES).filter(a => a.category === category);
}

function getQuickMindBodyActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'mind_body' && a.quick);
}

function getLongerMindBodyActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'mind_body' && !a.quick);
}

function getAllMindBodyActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'mind_body');
}

function getPhysicalActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'physical');
}

function getIndoorPhysicalActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'physical' && !a.outdoor);
}

function getOutdoorPhysicalActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'physical' && a.outdoor);
}

function getProfessionalActivities() {
  return Object.values(ACTIVITIES).filter(a => a.category === 'professional');
}

function getRandomMessage(type) {
  const messages = MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}

function getStreakMessage(streakDays) {
  const template = getRandomMessage('streak');
  return template.replace('{n}', streakDays);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ACTIVITIES,
    CATEGORIES,
    FEDERAL_HOLIDAYS_2026,
    MESSAGES,
    getActivitiesByCategory,
    getQuickMindBodyActivities,
    getLongerMindBodyActivities,
    getAllMindBodyActivities,
    getPhysicalActivities,
    getIndoorPhysicalActivities,
    getOutdoorPhysicalActivities,
    getProfessionalActivities,
    getRandomMessage,
    getStreakMessage
  };
}
