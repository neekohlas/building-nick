/**
 * Building Nick - Positive messaging library
 */

export const MESSAGES = {
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
}

export function getRandomMessage(type: keyof typeof MESSAGES): string {
  const messages = MESSAGES[type]
  return messages[Math.floor(Math.random() * messages.length)]
}

export function getStreakMessage(streakDays: number): string {
  const template = getRandomMessage('streak')
  return template.replace('{n}', String(streakDays))
}

export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}
