/**
 * Generate the JSON payload for updating The Tools in Notion
 * Outputs to /tmp/tools-update-payload.json for use with curl
 * Uses compact keys to fit within Notion's character limits:
 *   i=id, t=title, y=type, m=image, mp=mappings, p=problem
 *   c=cue, s=steps, n=instructions, fa=fightingAgainst, hf=higherForce, ou=otherUses
 */
const fs = require('fs')

const INTRO_CARD = {
  i: 'intro', t: 'The Tools — Phil Stutz', y: 'intro_card',
  m: '/tools/book-cover.jpg',
  mp: [
    { p: 'Avoiding something painful', t: 'Reversal of Desire' },
    { p: 'Angry or resentful at someone', t: 'Active Love' },
    { p: 'Feeling insecure or anxious', t: 'Inner Authority' },
    { p: 'Negative thinking or worry', t: 'Grateful Flow' }
  ]
}

const REVERSAL_CARD = {
  i: 'card_reversal', t: 'Reversal of Desire', y: 'tool_card',
  m: '/tools/reversal-of-desire.svg',
  c: 'Use when you have to do something uncomfortable and feel fear or resistance — right before you act. Also use it whenever you think about doing something painful or difficult; practicing with these thoughts builds the force to act when the time comes.',
  fa: "Pain avoidance — the powerful habit of deferring anything painful for immediate relief. The penalty, helpless regret at a life you wasted, won't come until far in the future. This is why most people can't move forward and live life to the fullest.",
  hf: "The Force of Forward Motion — the higher force that drives all of life expresses itself in relentless forward motion. The only way to connect to this force is to be in forward motion yourself, and to do that you must face pain and move past it. Once connected, the world is less intimidating, your energy is greater, and the future seems more hopeful.",
  s: [
    'Focus on the pain you\'re avoiding; see it appear in front of you as a cloud. Silently scream, "Bring it on!" to demand the pain; you want it because it has great value.',
    'Scream silently, "I love pain!" as you keep moving forward. Move so deeply into the pain you\'re at one with it.',
    'Feel the cloud spit you out and close behind you. Say inwardly, "Pain sets me free!" As you leave the cloud, feel yourself propelled forward into a realm of pure light.'
  ]
}

const REVERSAL_AUDIO = {
  i: 'audio_reversal', t: 'Reversal of Desire — Audio Guide', y: 'instructions',
  n: '<h4>Reversal of Desire</h4>\n<p>For overcoming avoidance and procrastination</p>\n<ol>\n<li>Focus on the pain you\'re avoiding; see it appear in front of you as a cloud. Silently scream, "Bring it on!" to demand the pain; you want it because it has great value.</li>\n<li>Scream silently, "I love pain!" as you keep moving forward. Move so deeply into the pain you\'re at one with it.</li>\n<li>Feel the cloud spit you out and close behind you. Say inwardly, "Pain sets me free!" As you leave the cloud, feel yourself propelled forward into a realm of pure light.</li>\n</ol>'
}

const ACTIVE_LOVE_CARD = {
  i: 'card_active_love', t: 'Active Love', y: 'tool_card',
  m: '/tools/active-love.svg',
  c: 'Use the moment someone does something that angers you. Use it when you find yourself reliving a personal injustice, whether recent or distant past. Also use it to prepare yourself to confront a difficult person.',
  fa: "The Maze — the childish belief that people will treat you \"fairly.\" You refuse to move forward with life until the wrong you experienced is rectified. Since that rarely happens, you're trapped, replaying what happened or fantasizing about revenge while the world moves forward without you.",
  hf: "The Force of Outflow — Active Love creates Outflow, the force that accepts everything as it is. This dissolves your sense of unfairness so you can give without reservation. Once you're in that state, nothing can make you withdraw. You are the chief beneficiary; you become unstoppable.",
  s: [
    'Concentration: Feel your heart expand to encompass the world of infinite love surrounding you. When your heart contracts back to normal size, it concentrates all this love inside your chest.',
    'Transmission: Send all the love from your chest to the other person, holding nothing back.',
    "Penetration: When the love enters the other person, don't just watch — feel it enter; sense a oneness with them. Then relax, and you'll feel all the energy you gave away returned to you."
  ]
}

const ACTIVE_LOVE_AUDIO = {
  i: 'audio_active_love', t: 'Active Love — Audio Guide', y: 'instructions',
  n: '<h4>Active Love</h4>\n<p>For anger, resentment, or frustration with someone</p>\n<ol>\n<li>Concentration: Feel your heart expand to encompass the world of infinite love surrounding you. When your heart contracts back to normal size, it concentrates all this love inside your chest.</li>\n<li>Transmission: Send all the love from your chest to the other person, holding nothing back.</li>\n<li>Penetration: When the love enters the other person, don\'t just watch — feel it enter; sense a oneness with them. Then relax, and you\'ll feel all the energy you gave away returned to you.</li>\n</ol>'
}

const INNER_AUTHORITY_CARD = {
  i: 'card_inner_authority', t: 'Inner Authority', y: 'tool_card',
  m: '/tools/inner-authority.svg',
  c: "Use whenever you feel performance anxiety — social events, confrontations, speaking in public. Use it right before and during the event. Also use it when you're anticipating an event and worrying about it.",
  fa: "The Shadow — insecurity is universal but badly misunderstood. We think it's about our appearance, education, or status, but deep inside is the Shadow, the embodiment of all our negative traits. We're terrified someone will see it, so we expend energy hiding it, which makes it impossible to be ourselves.",
  hf: 'The Force of Self-Expression — this force allows us to reveal ourselves truthfully, without caring about others\' approval. It speaks through us with unusual clarity and authority, and also expresses itself nonverbally, like when an athlete is "in the zone." In adults, this force gets buried in the Shadow. By connecting to the Shadow, you resurrect the force and have it flow through you.',
  s: [
    "Standing in front of any kind of audience, see your Shadow off to one side, facing you. It works just as well with an imaginary audience or an audience of only one person. Ignore the audience completely and focus all of your attention on the Shadow. Feel an unbreakable bond between the two of you — as a unit you're fearless.",
    'Together, you and the Shadow forcefully turn toward the audience and silently command them to "LISTEN!" Feel the authority that comes when you and your Shadow speak with one voice.'
  ],
  ou: [
    "Overcome initial shyness, particularly around people you're interested in romantically.",
    'Express need and vulnerability. Many people hide behind a facade that says they need nothing from others.',
    "Connect to your loved ones with more emotion. Without emotion, you can't have enough impact to form a real connection.",
    "Activate a higher force in writing. Writer's block happens when writers become more interested in the outcome than in the process."
  ]
}

const INNER_AUTHORITY_AUDIO = {
  i: 'audio_inner_authority', t: 'Inner Authority — Audio Guide', y: 'instructions',
  n: "<h4>Inner Authority</h4>\n<p>For insecurity, performance anxiety, or self-doubt</p>\n<ol>\n<li>Standing in front of any kind of audience, see your Shadow off to one side, facing you. Ignore the audience completely and focus all of your attention on the Shadow. Feel an unbreakable bond between the two of you — as a unit you're fearless.</li>\n<li>Together, you and the Shadow forcefully turn toward the audience and silently command them to \"LISTEN!\" Feel the authority that comes when you and your Shadow speak with one voice.</li>\n</ol>"
}

const GRATEFUL_FLOW_CARD = {
  i: 'card_grateful_flow', t: 'Grateful Flow', y: 'tool_card',
  m: '/tools/grateful-flow.svg',
  c: "Use immediately whenever you are attacked by negative thoughts — if unchallenged, they just get stronger. Use it any time your mind becomes undirected: on hold during a phone call, stuck in traffic, standing in line. You can also make it part of your daily schedule, turning specific times (waking up, going to sleep, mealtimes) into cues.",
  fa: "The Black Cloud — when your mind is filled with worry, self-hatred, or any other form of negative thinking. It limits what you can do with your life and deprives your loved ones of what is best about you. We cling to negative thinking because of the unconscious delusion that it can control the universe.",
  hf: "The Source — far from being indifferent to us, there's a higher force in the universe that created us and remains intimately involved with our well-being. The experience of its overwhelming power dissolves all negativity. But without Gratefulness, we can't perceive the Source.",
  s: [
    "Start by silently stating to yourself specific things in your life you're grateful for, particularly items you'd normally take for granted. Go slowly so you really feel the gratefulness for each item. Don't use the same items each time — you should feel a slight strain from having to come up with new ideas.",
    "After about thirty seconds, stop thinking and focus on the physical sensation of gratefulness. You'll feel it coming directly from your heart. This energy you are giving out is the Grateful Flow.",
    "As this energy emanates from your heart, your chest will soften and open. In this state you will feel an overwhelming presence approach you, filled with the power of infinite giving. You've made a connection to the Source."
  ]
}

const GRATEFUL_FLOW_AUDIO = {
  i: 'audio_grateful_flow', t: 'Grateful Flow — Audio Guide', y: 'instructions',
  n: "<h4>Grateful Flow</h4>\n<p>For negative thinking, worry, or self-hatred</p>\n<ol>\n<li>Start by silently stating to yourself specific things in your life you're grateful for, particularly items you'd normally take for granted. Go slowly so you really feel the gratefulness for each item. Don't use the same items each time — you should feel a slight strain from having to come up with new ideas.</li>\n<li>After about thirty seconds, stop thinking and focus on the physical sensation of gratefulness. You'll feel it coming directly from your heart. This energy you are giving out is the Grateful Flow.</li>\n<li>As this energy emanates from your heart, your chest will soften and open. In this state you will feel an overwhelming presence approach you, filled with the power of infinite giving. You've made a connection to the Source.</li>\n</ol>"
}

const MAIN_INSTRUCTIONS = '<h4>The Tools — Phil Stutz</h4>\n<p>Four powerful psychological tools for overcoming common mental blocks. Choose the tool that fits your current challenge:</p>\n<ul>\n<li><b>Reversal of Desire:</b> When you\'re avoiding or procrastinating on something painful</li>\n<li><b>Active Love:</b> When you\'re angry or resentful toward someone</li>\n<li><b>Inner Authority:</b> When you\'re feeling insecure or anxious about performance</li>\n<li><b>Grateful Flow:</b> When you\'re stuck in negative thinking or worry</li>\n</ul>\n<p>Swipe through the tools below. Each has a reference card and an audio guide. These work best when practiced regularly, not just in crisis moments.</p>'

const lessons = [
  INTRO_CARD, REVERSAL_CARD,
  ACTIVE_LOVE_CARD,
  INNER_AUTHORITY_CARD,
  GRATEFUL_FLOW_CARD
]

const lessonsJson = JSON.stringify(lessons)
console.log('Lessons JSON length:', lessonsJson.length)

const BLOCK_LIMIT = 2000
const textBlocks = []
for (let i = 0; i < lessonsJson.length; i += BLOCK_LIMIT) {
  textBlocks.push({ type: 'text', text: { content: lessonsJson.slice(i, i + BLOCK_LIMIT) } })
}
console.log('Text blocks needed:', textBlocks.length)

const payload = JSON.stringify({
  properties: {
    Instructions: { rich_text: [{ type: 'text', text: { content: MAIN_INSTRUCTIONS } }] },
    Lessons: { rich_text: textBlocks },
    'Claude Prompt': { rich_text: [{ type: 'text', text: { content: '' } }] }
  }
})

fs.writeFileSync('/tmp/tools-update-payload.json', payload)
console.log('Payload written to /tmp/tools-update-payload.json (' + payload.length + ' bytes)')
