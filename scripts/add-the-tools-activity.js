/**
 * Add "The Tools" activity to Notion
 * Based on Phil Stutz & Barry Michels' book "The Tools"
 *
 * Contains 4 psychological tools:
 * 1. Reversal of Desire - For overcoming avoidance/procrastination
 * 2. Active Love - For dealing with anger/resentment
 * 3. Inner Authority - For overcoming insecurity/performance anxiety
 * 4. Grateful Flow - For combating negative thinking
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY
const DATABASE_ID = process.env.NOTION_DATABASE_ID

const theToolsActivity = {
  id: 'the_tools',
  name: 'The Tools (Phil Stutz)',
  description: `Four powerful psychological tools from Phil Stutz & Barry Michels for overcoming common mental blocks. Each tool addresses a specific challenge: avoidance/fear (Reversal of Desire), anger/resentment (Active Love), insecurity/anxiety (Inner Authority), or negative thinking (Grateful Flow). Choose the tool that fits your current state.`,
  category: 'Mind-Body',
  duration: 5,
  quick: true,
  instructions: `<h4>Instructions</h4>
<ol>
<li>Identify what you're struggling with right now</li>
<li>Choose the appropriate tool:
  <ul>
  <li><b>Avoiding something?</b> → Reversal of Desire</li>
  <li><b>Angry at someone?</b> → Active Love</li>
  <li><b>Feeling insecure?</b> → Inner Authority</li>
  <li><b>Negative thoughts?</b> → Grateful Flow</li>
  </ul>
</li>
<li>Swipe to that tool and follow the guided audio</li>
<li>Practice the visualization with full commitment</li>
</ol>
<p>These tools work best when practiced regularly, not just in crisis moments.</p>`,
  heart: 0.7,
  mind: 0.8,
  body: 0.2,
  learn: 0.5,
  lessons: JSON.stringify([
    {
      id: 'tool_reversal',
      title: 'Reversal of Desire',
      type: 'claude_audio',
      prompt: 'reversal_of_desire'
    },
    {
      id: 'tool_active_love',
      title: 'Active Love',
      type: 'claude_audio',
      prompt: 'active_love'
    },
    {
      id: 'tool_inner_authority',
      title: 'Inner Authority',
      type: 'claude_audio',
      prompt: 'inner_authority'
    },
    {
      id: 'tool_grateful_flow',
      title: 'Grateful Flow',
      type: 'claude_audio',
      prompt: 'grateful_flow'
    }
  ]),
  claudePrompt: `Guide a 2-3 min session for the selected Phil Stutz tool. Use warm tone, include "... [pause] ..." for visualizations.

REVERSAL OF DESIRE (avoiding something painful):
1. See the pain as a dark cloud ahead
2. Scream "Bring it on!" - want this pain
3. Move INTO the cloud saying "I love pain!"
4. Cloud spits you out: "Pain sets me free!"
5. Feel propelled into light and possibility

ACTIVE LOVE (anger at someone):
1. CONCENTRATION: Heart expands with infinite love, then contracts into chest
2. TRANSMISSION: Send ALL love to the person, hold nothing back
3. PENETRATION: Feel love enter them, sense oneness, energy returns

INNER AUTHORITY (insecurity/anxiety):
1. See your Shadow (all negative traits) beside you
2. Feel unbreakable bond - together you're fearless
3. Turn to the audience and command: "LISTEN!"
4. Feel authority when you and Shadow speak as one

GRATEFUL FLOW (negative thinking):
1. Name specific gratitudes slowly, feel each one
2. After 30s, focus on physical sensation of gratefulness in heart
3. Let energy emanate from chest, softening it
4. Feel the Source approach with infinite giving power

Don't explain psychology - just guide the experience.`
}

async function createActivity(activity) {
  const properties = {
    'Name': {
      title: [{ text: { content: activity.name } }]
    },
    'ID': {
      rich_text: [{ text: { content: activity.id } }]
    },
    'Description': {
      rich_text: [{ text: { content: activity.description } }]
    },
    'Category': {
      select: { name: activity.category }
    },
    'Duration': {
      number: activity.duration
    },
    'Quick': {
      checkbox: activity.quick
    },
    'Instructions': {
      rich_text: [{ text: { content: activity.instructions } }]
    },
    'Heart': {
      number: activity.heart
    },
    'Mind': {
      number: activity.mind
    },
    'Body': {
      number: activity.body
    },
    'Learn': {
      number: activity.learn
    }
  }

  // Add Lessons if present
  if (activity.lessons) {
    properties['Lessons'] = {
      rich_text: [{ text: { content: activity.lessons } }]
    }
  }

  // Add Claude Prompt if present
  if (activity.claudePrompt) {
    properties['Claude Prompt'] = {
      rich_text: [{ text: { content: activity.claudePrompt } }]
    }
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: DATABASE_ID },
      properties
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create ${activity.name}: ${error}`)
  }

  return activity.name
}

async function main() {
  console.log('Adding "The Tools" activity to Notion...\n')

  try {
    const name = await createActivity(theToolsActivity)
    console.log(`✓ Created: ${name}`)
    console.log('\n--- Summary ---')
    console.log('Activity created with 4 tool lessons:')
    console.log('  1. Reversal of Desire (avoidance/fear)')
    console.log('  2. Active Love (anger/resentment)')
    console.log('  3. Inner Authority (insecurity/anxiety)')
    console.log('  4. Grateful Flow (negative thinking)')
  } catch (error) {
    console.error('Error:', error.message)
  }
}

main()
