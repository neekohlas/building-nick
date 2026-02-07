/**
 * Update "The Tools" activity in Notion
 * Full-fidelity content from Phil Stutz & Barry Michels' book "The Tools"
 * Each tool has a tool_card (reference) and instructions (TTS audio guide)
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY
const DATABASE_ID = process.env.NOTION_DATABASE_ID

// ─── REVERSAL OF DESIRE ────────────────────────────────────────────────────

const REVERSAL_CARD = {
  id: 'card_reversal',
  title: 'Reversal of Desire',
  type: 'tool_card',
  cue: 'Use when you have to do something uncomfortable and feel fear or resistance — right before you act. Also use it whenever you think about doing something painful or difficult; practicing with these thoughts builds the force to act when the time comes.',
  fightingAgainst: 'Pain avoidance — the powerful habit of deferring anything painful for immediate relief. The penalty, helpless regret at a life you wasted, won\'t come until far in the future. This is why most people can\'t move forward and live life to the fullest.',
  higherForce: 'The Force of Forward Motion — the higher force that drives all of life expresses itself in relentless forward motion. The only way to connect to this force is to be in forward motion yourself, and to do that you must face pain and move past it. Once connected, the world is less intimidating, your energy is greater, and the future seems more hopeful.',
  steps: [
    'Focus on the pain you\'re avoiding; see it appear in front of you as a cloud. Silently scream, "Bring it on!" to demand the pain; you want it because it has great value.',
    'Scream silently, "I love pain!" as you keep moving forward. Move so deeply into the pain you\'re at one with it.',
    'Feel the cloud spit you out and close behind you. Say inwardly, "Pain sets me free!" As you leave the cloud, feel yourself propelled forward into a realm of pure light.'
  ]
}

const REVERSAL_AUDIO = {
  id: 'audio_reversal',
  title: 'Reversal of Desire — Audio Guide',
  type: 'instructions',
  instructions: `<h4>Reversal of Desire</h4>
<p>For overcoming avoidance and procrastination</p>
<ol>
<li>Focus on the pain you're avoiding; see it appear in front of you as a cloud. Silently scream, "Bring it on!" to demand the pain; you want it because it has great value.</li>
<li>Scream silently, "I love pain!" as you keep moving forward. Move so deeply into the pain you're at one with it.</li>
<li>Feel the cloud spit you out and close behind you. Say inwardly, "Pain sets me free!" As you leave the cloud, feel yourself propelled forward into a realm of pure light.</li>
</ol>`
}

// ─── ACTIVE LOVE ────────────────────────────────────────────────────────────

const ACTIVE_LOVE_CARD = {
  id: 'card_active_love',
  title: 'Active Love',
  type: 'tool_card',
  cue: 'Use the moment someone does something that angers you. Use it when you find yourself reliving a personal injustice, whether recent or distant past. Also use it to prepare yourself to confront a difficult person.',
  fightingAgainst: 'The Maze — the childish belief that people will treat you "fairly." You refuse to move forward with life until the wrong you experienced is rectified. Since that rarely happens, you\'re trapped, replaying what happened or fantasizing about revenge while the world moves forward without you.',
  higherForce: 'The Force of Outflow — Active Love creates Outflow, the force that accepts everything as it is. This dissolves your sense of unfairness so you can give without reservation. Once you\'re in that state, nothing can make you withdraw. You are the chief beneficiary; you become unstoppable.',
  steps: [
    'Concentration: Feel your heart expand to encompass the world of infinite love surrounding you. When your heart contracts back to normal size, it concentrates all this love inside your chest.',
    'Transmission: Send all the love from your chest to the other person, holding nothing back.',
    'Penetration: When the love enters the other person, don\'t just watch — feel it enter; sense a oneness with them. Then relax, and you\'ll feel all the energy you gave away returned to you.'
  ]
}

const ACTIVE_LOVE_AUDIO = {
  id: 'audio_active_love',
  title: 'Active Love — Audio Guide',
  type: 'instructions',
  instructions: `<h4>Active Love</h4>
<p>For anger, resentment, or frustration with someone</p>
<ol>
<li>Concentration: Feel your heart expand to encompass the world of infinite love surrounding you. When your heart contracts back to normal size, it concentrates all this love inside your chest.</li>
<li>Transmission: Send all the love from your chest to the other person, holding nothing back.</li>
<li>Penetration: When the love enters the other person, don't just watch — feel it enter; sense a oneness with them. Then relax, and you'll feel all the energy you gave away returned to you.</li>
</ol>`
}

// ─── INNER AUTHORITY ────────────────────────────────────────────────────────

const INNER_AUTHORITY_CARD = {
  id: 'card_inner_authority',
  title: 'Inner Authority',
  type: 'tool_card',
  cue: 'Use whenever you feel performance anxiety — social events, confrontations, speaking in public. Use it right before and during the event. Also use it when you\'re anticipating an event and worrying about it.',
  fightingAgainst: 'The Shadow — insecurity is universal but badly misunderstood. We think it\'s about our appearance, education, or status, but deep inside is the Shadow, the embodiment of all our negative traits. We\'re terrified someone will see it, so we expend energy hiding it, which makes it impossible to be ourselves.',
  higherForce: 'The Force of Self-Expression — this force allows us to reveal ourselves truthfully, without caring about others\' approval. It speaks through us with unusual clarity and authority, and also expresses itself nonverbally, like when an athlete is "in the zone." In adults, this force gets buried in the Shadow. By connecting to the Shadow, you resurrect the force and have it flow through you.',
  steps: [
    'Standing in front of any kind of audience, see your Shadow off to one side, facing you. It works just as well with an imaginary audience or an audience of only one person. Ignore the audience completely and focus all of your attention on the Shadow. Feel an unbreakable bond between the two of you — as a unit you\'re fearless.',
    'Together, you and the Shadow forcefully turn toward the audience and silently command them to "LISTEN!" Feel the authority that comes when you and your Shadow speak with one voice.'
  ],
  otherUses: [
    'Overcome initial shyness, particularly around people you\'re interested in romantically. People who get the most opportunities to connect aren\'t those who make the best partners — they\'re those who put themselves out there the most.',
    'Express need and vulnerability. Many people, especially males, hide behind a facade that says they need nothing from others. Life has a way of breaking this down and putting you where you must ask for help.',
    'Connect to your loved ones with more emotion. The way you communicate, especially the emotion you express, is more important than the words you use. Without emotion, you can\'t have enough impact to form a real connection.',
    'Activate a higher force in writing. Writer\'s block happens when writers become more interested in the outcome than in the process, usually taking the form of frustrated perfectionism and harsh self-criticism.'
  ]
}

const INNER_AUTHORITY_AUDIO = {
  id: 'audio_inner_authority',
  title: 'Inner Authority — Audio Guide',
  type: 'instructions',
  instructions: `<h4>Inner Authority</h4>
<p>For insecurity, performance anxiety, or self-doubt</p>
<ol>
<li>Standing in front of any kind of audience, see your Shadow off to one side, facing you. Ignore the audience completely and focus all of your attention on the Shadow. Feel an unbreakable bond between the two of you — as a unit you're fearless.</li>
<li>Together, you and the Shadow forcefully turn toward the audience and silently command them to "LISTEN!" Feel the authority that comes when you and your Shadow speak with one voice.</li>
</ol>`
}

// ─── GRATEFUL FLOW ──────────────────────────────────────────────────────────

const GRATEFUL_FLOW_CARD = {
  id: 'card_grateful_flow',
  title: 'Grateful Flow',
  type: 'tool_card',
  cue: 'Use immediately whenever you are attacked by negative thoughts — if unchallenged, they just get stronger. Use it any time your mind becomes undirected: on hold during a phone call, stuck in traffic, standing in line. You can also make it part of your daily schedule, turning specific times (waking up, going to sleep, mealtimes) into cues.',
  fightingAgainst: 'The Black Cloud — when your mind is filled with worry, self-hatred, or any other form of negative thinking. It limits what you can do with your life and deprives your loved ones of what is best about you. We cling to negative thinking because of the unconscious delusion that it can control the universe.',
  higherForce: 'The Source — far from being indifferent to us, there\'s a higher force in the universe that created us and remains intimately involved with our well-being. The experience of its overwhelming power dissolves all negativity. But without Gratefulness, we can\'t perceive the Source.',
  steps: [
    'Start by silently stating to yourself specific things in your life you\'re grateful for, particularly items you\'d normally take for granted. You can also include bad things that aren\'t happening. Go slowly so you really feel the gratefulness for each item. Don\'t use the same items each time — you should feel a slight strain from having to come up with new ideas.',
    'After about thirty seconds, stop thinking and focus on the physical sensation of gratefulness. You\'ll feel it coming directly from your heart. This energy you are giving out is the Grateful Flow.',
    'As this energy emanates from your heart, your chest will soften and open. In this state you will feel an overwhelming presence approach you, filled with the power of infinite giving. You\'ve made a connection to the Source.'
  ]
}

const GRATEFUL_FLOW_AUDIO = {
  id: 'audio_grateful_flow',
  title: 'Grateful Flow — Audio Guide',
  type: 'instructions',
  instructions: `<h4>Grateful Flow</h4>
<p>For negative thinking, worry, or self-hatred</p>
<ol>
<li>Start by silently stating to yourself specific things in your life you're grateful for, particularly items you'd normally take for granted. Go slowly so you really feel the gratefulness for each item. Don't use the same items each time — you should feel a slight strain from having to come up with new ideas.</li>
<li>After about thirty seconds, stop thinking and focus on the physical sensation of gratefulness. You'll feel it coming directly from your heart. This energy you are giving out is the Grateful Flow.</li>
<li>As this energy emanates from your heart, your chest will soften and open. In this state you will feel an overwhelming presence approach you, filled with the power of infinite giving. You've made a connection to the Source.</li>
</ol>`
}

// ─── INTRO CARD ─────────────────────────────────────────────────────────────

const INTRO_CARD = {
  id: 'intro',
  title: 'The Tools — Phil Stutz',
  type: 'intro_card',
  image: '/tools-cover.jpg',
  mappings: [
    { problem: 'Avoiding something painful', tool: 'Reversal of Desire' },
    { problem: 'Angry or resentful at someone', tool: 'Active Love' },
    { problem: 'Feeling insecure or anxious', tool: 'Inner Authority' },
    { problem: 'Negative thinking or worry', tool: 'Grateful Flow' }
  ]
}

// ─── MAIN INSTRUCTIONS ──────────────────────────────────────────────────────

const MAIN_INSTRUCTIONS = `<h4>The Tools — Phil Stutz</h4>
<p>Four powerful psychological tools for overcoming common mental blocks. Choose the tool that fits your current challenge:</p>
<ul>
<li><b>Reversal of Desire:</b> When you're avoiding or procrastinating on something painful</li>
<li><b>Active Love:</b> When you're angry or resentful toward someone</li>
<li><b>Inner Authority:</b> When you're feeling insecure or anxious about performance</li>
<li><b>Grateful Flow:</b> When you're stuck in negative thinking or worry</li>
</ul>
<p>Swipe through the tools below. Each has a reference card and an audio guide. These work best when practiced regularly, not just in crisis moments.</p>`

// ─── LESSONS ARRAY ──────────────────────────────────────────────────────────

const lessons = [
  INTRO_CARD,
  REVERSAL_CARD,
  REVERSAL_AUDIO,
  ACTIVE_LOVE_CARD,
  ACTIVE_LOVE_AUDIO,
  INNER_AUTHORITY_CARD,
  INNER_AUTHORITY_AUDIO,
  GRATEFUL_FLOW_CARD,
  GRATEFUL_FLOW_AUDIO
]

// ─── NOTION API ─────────────────────────────────────────────────────────────

async function findToolsPage() {
  const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'ID',
        rich_text: {
          equals: 'the_tools'
        }
      }
    })
  })

  const data = await response.json()
  return data.results?.[0]
}

async function updateActivity(pageId) {
  const lessonsJson = JSON.stringify(lessons)
  console.log('Lessons JSON length:', lessonsJson.length)
  console.log('Main instructions length:', MAIN_INSTRUCTIONS.length)

  // Notion rich_text has a 2000 char limit per text block
  // Split lessons JSON across multiple text blocks if needed
  const BLOCK_LIMIT = 2000
  const textBlocks = []
  for (let i = 0; i < lessonsJson.length; i += BLOCK_LIMIT) {
    textBlocks.push({
      type: 'text',
      text: { content: lessonsJson.slice(i, i + BLOCK_LIMIT) }
    })
  }

  console.log(`Splitting lessons into ${textBlocks.length} text block(s)`)

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        'Instructions': {
          rich_text: [{ type: 'text', text: { content: MAIN_INSTRUCTIONS } }]
        },
        'Lessons': {
          rich_text: textBlocks
        },
        'Claude Prompt': {
          rich_text: [{ type: 'text', text: { content: '' } }]
        }
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Error response:', errorText)
  }

  return response.ok
}

async function main() {
  console.log('Updating "The Tools" activity in Notion...\n')

  const page = await findToolsPage()
  if (!page) {
    console.error('The Tools activity not found!')
    return
  }

  console.log('Found page:', page.id)
  console.log('Updating with full-fidelity content for all 4 tools...')
  console.log(`  - ${lessons.length} lesson cards (intro + 4 tool cards + 4 audio guides)`)

  const success = await updateActivity(page.id)
  if (success) {
    console.log('\n✓ The Tools activity updated successfully!')
    console.log('\nContent includes:')
    console.log('  - Intro card with problem→tool mapping')
    console.log('  - Reversal of Desire: card + audio guide')
    console.log('  - Active Love: card + audio guide')
    console.log('  - Inner Authority: card + audio guide (with Other Uses)')
    console.log('  - Grateful Flow: card + audio guide')
    console.log('\nNew fields per tool card:')
    console.log('  - cue: comprehensive "when to use" triggers')
    console.log('  - fightingAgainst: what negative force you\'re overcoming')
    console.log('  - higherForce: the positive force you connect to')
    console.log('  - otherUses: additional applications (Inner Authority only)')
  } else {
    console.error('Failed to update activity')
  }
}

main().catch(console.error)
