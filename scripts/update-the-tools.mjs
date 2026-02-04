/**
 * Script to update "The Tools" activity in Notion with new lesson format
 *
 * Run with: node scripts/update-the-tools.mjs
 *
 * Uses compact format with short keys to fit within Notion's 2000 char limit:
 * - i: id
 * - t: title
 * - y: type
 * - m: image
 * - c: cue
 * - s: steps
 * - mp: mappings (with p: problem, t: tool)
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local manually
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const env = {}
    for (const line of content.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
    return env
  } catch (e) {
    console.error('Failed to load .env.local:', e.message)
    return {}
  }
}

const env = loadEnv()
const NOTION_API_KEY = env.NOTION_API_KEY
const NOTION_DATABASE_ID = env.NOTION_DATABASE_ID

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Missing NOTION_API_KEY or NOTION_DATABASE_ID in .env.local')
  process.exit(1)
}

// The Tools lesson data using compact format (short keys)
// This format is expanded to full keys in the API route
const THE_TOOLS_LESSONS = [
  {
    i: 'intro',
    t: 'The Tools',
    y: 'intro_card',
    m: '/tools/book-cover.jpg',
    mp: [
      { p: 'Avoiding pain', t: 'Reversal of Desire' },
      { p: 'Resentment/hurt', t: 'Active Love' },
      { p: 'Fear of judgment', t: 'Inner Authority' },
      { p: 'Negative thoughts', t: 'Grateful Flow' }
    ]
  },
  {
    i: 'rod',
    t: 'Reversal of Desire',
    y: 'tool_card',
    m: '/tools/reversal-of-desire.svg',
    c: 'When avoiding pain, procrastinating, or fearing something.',
    s: [
      'See the pain as a cloud in front of you.',
      'Scream "Bring it on!" - demand it come at you.',
      'Feel it pass through you as you move toward it.',
      'Emerge into pure light, feel energy/vitality.',
      'Say: "Pain sets me free."'
    ]
  },
  {
    i: 'al',
    t: 'Active Love',
    y: 'tool_card',
    m: '/tools/active-love.svg',
    c: 'When feeling wronged or stuck in resentment.',
    s: [
      'Focus on your heart. Visualize warm liquid light.',
      'Send love toward the person you resent.',
      'Continue sending love infinitely.',
      'Feel relief escaping The Maze.',
      'Say: "Outflow brings freedom."'
    ]
  },
  {
    i: 'ia',
    t: 'Inner Authority',
    y: 'tool_card',
    m: '/tools/inner-authority.svg',
    c: 'When worried about judgment or feeling insecure.',
    s: [
      'Feel the Shadow - the part you hide.',
      'Turn and face it. Accept it.',
      'Invite it to merge with you.',
      'Face your audience as a whole person.',
      'Say: "The Shadow gives me authority."'
    ]
  },
  {
    i: 'gf',
    t: 'Grateful Flow',
    y: 'tool_card',
    m: '/tools/grateful-flow.svg',
    c: 'When trapped in negativity or worry.',
    s: [
      'Find specific things to be grateful for.',
      'Feel genuine gratefulness, let it build.',
      'Direct it upward toward The Source.',
      'Feel connection to something larger.',
      'Say: "Gratefulness lifts me above the cloud."'
    ]
  }
]

async function findActivityByName(name) {
  const response = await fetch(
    `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'Name',
          title: {
            contains: name
          }
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to search: ${response.status}`)
  }

  const data = await response.json()
  if (data.results.length === 0) {
    return null
  }

  return data.results[0].id
}

async function updateActivityLessons(pageId, lessons) {
  const lessonsJson = JSON.stringify(lessons)

  console.log(`Lessons JSON size: ${lessonsJson.length} characters`)

  if (lessonsJson.length > 2000) {
    throw new Error(`Lessons JSON is ${lessonsJson.length} chars, exceeds Notion's 2000 char limit!`)
  }

  const response = await fetch(
    `https://api.notion.com/v1/pages/${pageId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          'Lessons': {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: lessonsJson
                }
              }
            ]
          }
        }
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update: ${response.status} - ${error}`)
  }

  return response.json()
}

async function main() {
  console.log('Looking for "The Tools" activity in Notion...')

  const pageId = await findActivityByName('The Tools')

  if (!pageId) {
    console.error('Could not find "The Tools" activity in Notion.')
    console.log('Make sure it exists in your database.')
    process.exit(1)
  }

  console.log(`Found "The Tools" with page ID: ${pageId}`)
  console.log('Updating with new lessons...')

  await updateActivityLessons(pageId, THE_TOOLS_LESSONS)

  console.log('Successfully updated "The Tools" activity!')
  console.log('\nNote: Add the book cover image at /public/tools/book-cover.jpg')
}

main().catch(console.error)
