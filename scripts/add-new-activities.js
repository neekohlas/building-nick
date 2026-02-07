// Script to add new mind-body activities to Notion database
// Run with: node scripts/add-new-activities.js
// Set environment variables: NOTION_API_KEY, NOTION_DATABASE_ID

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID environment variables are required');
  process.exit(1);
}

// New activities to add
const NEW_ACTIVITIES = [
  {
    id: 'yoga_nidra',
    name: 'Yoga Nidra',
    description: 'Yoga Nidra ("yogic sleep") is a guided meditation practiced lying down that induces deep relaxation while maintaining awareness. It systematically relaxes the body and mind, reducing stress and promoting healing. Unlike sleep, you remain conscious throughout.',
    category: 'Mind-Body',
    duration: 30,
    quick: false,
    instructions: `Find a comfortable lying position
Close your eyes and settle in
Follow the guided meditation
Allow yourself to drift into deep relaxation while staying aware
When the session ends, slowly bring awareness back to your body`,
    video: 'https://www.youtube.com/watch?v=example_yoga_nidra', // Replace with actual URL
    heart: 0.4,
    mind: 0.7,
    body: 0.3,
    lessons: JSON.stringify([
      { id: 'nidra_cloud', title: 'The Cloud (NSDR)', type: 'youtube', url: 'https://www.youtube.com/watch?v=example' }
    ])
  },
  {
    id: 'tapping_eft',
    name: 'Tapping / EFT',
    description: 'Emotional Freedom Technique (EFT) combines tapping on acupressure points while focusing on emotions or pain. By tapping specific meridian points while acknowledging discomfort, you can reduce the emotional charge and physical sensations associated with pain or stress.',
    category: 'Mind-Body',
    duration: 10,
    quick: true,
    instructions: `Identify what you want to work on (pain, emotion, stress)
Rate its intensity from 0-10
Tap the side of your hand while stating the issue
Tap through the points: eyebrow, side of eye, under eye, under nose, chin, collarbone, under arm
Continue tapping while acknowledging the feeling
Re-rate the intensity after a round`,
    video: 'https://www.youtube.com/watch?v=example_tapping', // Replace with actual URL
    heart: 0.5,
    mind: 0.5,
    body: 0.3,
    lessons: JSON.stringify([
      { id: 'tapping_pain', title: 'Tapping Through Pain', type: 'youtube', url: 'https://www.youtube.com/watch?v=example' }
    ])
  },
  {
    id: 'vipassana',
    name: 'Vipassana Meditation',
    description: 'Vipassana ("insight meditation") is an ancient Buddhist practice of observing sensations and thoughts without judgment. Find a comfortable seated position, focus on the breath rising and falling in the belly, and label sensations as they arise. When thoughts come, observe and label them rather than engaging. For urges to move, label "intention" before acting, then label each movement.',
    category: 'Mind-Body',
    duration: 15,
    quick: false,
    instructions: `Find a comfortable seated position
Cradle one hand in the other, thumbs touching, resting in your lap
Focus on the breath: notice the belly rising and falling
Label the movement: "rising, rising, rising" then "falling, falling, falling"
When thoughts arise, observe and label them without engaging
If you need to move, first label "intention" then describe each movement
Return attention gently to the breath`,
    heart: 0.3,
    mind: 0.8,
    body: 0.2
    // No lessons field - videos are for learning only, not embedded in app
  },
  {
    id: 'tai_chi',
    name: 'Tai Chi',
    description: 'Tai Chi is a Chinese martial art practiced as moving meditation. Through slow, flowing movements and deep breathing, it cultivates balance, flexibility, and inner calm. Often called "meditation in motion," Tai Chi reduces stress while gently strengthening the body.',
    category: 'Mind-Body',
    duration: 10,
    quick: false,
    instructions: `Stand with feet shoulder-width apart, knees slightly bent
Relax your shoulders and let arms hang naturally
Begin with slow, deep breaths
Follow the guided movements with fluidity
Move slowly and continuously, like flowing water
Coordinate breath with movement
Focus on balance and the sensation of weight shifting`,
    video: 'https://www.youtube.com/watch?v=example_tai_chi', // Replace with actual URL
    heart: 0.2,
    mind: 0.5,
    body: 0.7,
    lessons: JSON.stringify([
      { id: 'tai_chi_7min', title: '7 Minute Chi for Beginners', type: 'youtube', url: 'https://www.youtube.com/watch?v=example' }
    ])
  },
  {
    id: 'yoga_kassandra',
    name: 'Yoga with Kassandra',
    description: 'Gentle yoga flows designed for all levels. These routines combine stretching, breathing, and mindful movement to wake up the body, release tension, and build flexibility. Perfect for morning practice or anytime you need gentle movement.',
    category: 'Mind-Body',
    duration: 10,
    quick: false,
    instructions: `Find a comfortable space with room to move
Use a yoga mat if available
Follow along with the video
Move at your own pace - modify as needed
Focus on breath and sensation, not perfection
Rest in child\'s pose anytime you need a break`,
    heart: 0.2,
    mind: 0.4,
    body: 0.8,
    lessons: JSON.stringify([
      { id: 'yoga_morning_gentle', title: '10 min Gentle Morning Yoga', type: 'youtube', url: 'https://www.youtube.com/watch?v=example1' },
      { id: 'yoga_morning_stretch', title: '10 min Full Body Stretch', type: 'youtube', url: 'https://www.youtube.com/watch?v=example2' }
    ])
  },
  {
    id: 'forest_bathing',
    name: 'Forest Bathing',
    description: 'Shinrin-yoku ("forest bathing") is a Japanese practice of slow, sensory immersion in nature. Unlike hiking, there\'s no destination. Unlike nature study, you\'re not trying to learn facts. Simply be present: close your eyes and listen to birdsong and rustling leaves, feel bark textures, breathe in the forest scents (phytoncides from trees have measurable health benefits). Research shows it reduces cortisol, lowers blood pressure, and boosts immune function. Aim for 20+ minutes of unhurried, deviceless presence.',
    category: 'Mind-Body',
    duration: 30,
    quick: false,
    outdoor: true,
    instructions: `Leave your phone behind or on airplane mode
Walk slowly with no destination in mind
Stop frequently - there\'s nowhere to be
Close your eyes and listen to the sounds around you
Touch tree bark, leaves, moss - notice textures
Breathe deeply and notice the forest scents
Sit or stand quietly for extended periods
Let your senses guide you, not your thoughts`,
    heart: 0.4,
    mind: 0.5,
    body: 0.5
  },
  {
    id: 'somatic_tracking',
    name: 'Somatic Tracking',
    description: 'Somatic tracking retrains the brain\'s response to pain by observing sensations with curiosity and lightness rather than fear. The brain has learned to associate pain with danger; somatic tracking teaches it that these sensations are safe. Watch your pain like clouds drifting by or fish in an aquarium—relaxed, curious, not trying to change anything.',
    category: 'Mind-Body',
    duration: 10,
    quick: true,
    instructions: `Find a comfortable position
Take a few grounding breaths
Locate a sensation in your body - doesn\'t have to be painful
Observe it with casual curiosity, like people-watching at a cafe
Keep your attention lazy and loose - NOT like a hunter stalking prey
If you notice yourself tensing or zeroing in, soften and zoom out
Remember: the goal isn\'t to reduce pain, it\'s to show your brain these sensations are safe
Practice for 3-5 minutes, or longer if comfortable`,
    heart: 0.3,
    mind: 0.7,
    body: 0.4,
    lessons: JSON.stringify([
      { id: 'st_clouds', title: 'Clouds Metaphor', type: 'vimeo', url: 'https://vimeo.com/example_clouds' },
      { id: 'st_aquarium', title: 'Aquarium Metaphor', type: 'vimeo', url: 'https://vimeo.com/example_aquarium' },
      { id: 'st_car', title: 'Neighborhood Exploration', type: 'vimeo', url: 'https://vimeo.com/example_car' },
      { id: 'st_claude', title: 'Claude Audio Guide', type: 'claude_audio', prompt: 'somatic_tracking' }
    ]),
    claudePrompt: `Guide the user through a 3-5 minute somatic tracking session with a light, playful tone. Include natural pauses for observation—write these as "..." or phrases like "Take a moment here..." to create space.

Begin with a grounding breath. Invite them to notice a sensation—not to fix it or analyze it, just to observe.

Use fresh analogies (NOT clouds, aquarium, or car—those are in the video lessons): "Imagine you're people-watching at a cafe—you're not trying to follow anyone home, just casually noticing who walks by." Or: "Think of it like channel surfing—you're not committing to any show, just seeing what's on."

IMPORTANT: Remind them NOT to track pain like a hunter stalking prey. The goal isn't to hyperfocus, laser in, or stare down the sensation. That intensity signals threat. Instead, keep the attention lazy and loose—like glancing at something in your peripheral vision, or idly watching a screensaver. If they notice themselves tensing up or zeroing in, encourage them to zoom out, soften their gaze, maybe even let their attention wander for a moment before coming back.

The goal isn't to reduce pain right now—that would mean pain is still the enemy. The goal is to show the brain these sensations are boring, safe, not worth the alarm bells.

Include 3-4 pauses of about 10-15 seconds each (indicate with "... [pause] ...").

End by acknowledging their practice. Remind them this is a skill that builds with repetition—like learning an instrument, each session teaches the brain something new.`
  }
];

async function createActivity(activity) {
  const properties = {
    'Name': { title: [{ text: { content: activity.name } }] },
    'ID': { rich_text: [{ text: { content: activity.id } }] },
    'Description': { rich_text: [{ text: { content: activity.description } }] },
    'Category': { select: { name: activity.category } },
    'Duration': { number: activity.duration },
    'Quick': { checkbox: activity.quick || false },
    'Steps': { rich_text: [{ text: { content: activity.instructions } }] }
  };

  // Optional fields
  if (activity.video) {
    properties['Video'] = { url: activity.video };
  }
  if (activity.outdoor) {
    properties['Outdoor'] = { checkbox: true };
  }
  if (activity.heart !== undefined) {
    properties['Heart'] = { number: activity.heart };
  }
  if (activity.mind !== undefined) {
    properties['Mind'] = { number: activity.mind };
  }
  if (activity.body !== undefined) {
    properties['Body'] = { number: activity.body };
  }
  if (activity.lessons) {
    properties['Lessons'] = { rich_text: [{ text: { content: activity.lessons } }] };
  }
  if (activity.claudePrompt) {
    properties['Claude Prompt'] = { rich_text: [{ text: { content: activity.claudePrompt } }] };
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create "${activity.name}": ${response.status} - ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('Adding new activities to Notion database...\n');

  let created = 0;
  let errors = 0;

  for (const activity of NEW_ACTIVITIES) {
    try {
      await createActivity(activity);
      console.log(`Created: ${activity.name}`);
      created++;
      // Rate limiting - Notion allows 3 requests per second
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (error) {
      console.error(`Error creating "${activity.name}":`, error.message);
      errors++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
