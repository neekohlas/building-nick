/**
 * Script to populate Heart/Mind/Body spectrum scores in Notion
 *
 * Run with: npx ts-node --esm scripts/populate-spectrum-scores.ts
 *
 * Prerequisites:
 * 1. Add three Number columns to your Notion database: "Heart", "Mind", "Body"
 * 2. Set NOTION_API_KEY and NOTION_DATABASE_ID in .env.local
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Missing NOTION_API_KEY or NOTION_DATABASE_ID in .env.local')
  process.exit(1)
}

// Initial spectrum scores for activities (based on my judgment)
// Heart: Emotional/relational (journaling, gratitude, connection)
// Mind: Cognitive/focus (education, meditation, planning)
// Body: Movement/physical (exercises, stretches, outdoor)
const SPECTRUM_SCORES: Record<string, { heart: number; mind: number; body: number }> = {
  // Mind-Body Quick (1-5 min)
  'lin_health_education': { heart: 0.2, mind: 0.9, body: 0.1 },  // Educational, cognitive focus
  'breathing': { heart: 0.3, mind: 0.6, body: 0.4 },  // Mind-body, calming
  'external_orienting': { heart: 0.2, mind: 0.7, body: 0.3 },  // Sensory awareness, cognitive
  'internal_orienting': { heart: 0.4, mind: 0.5, body: 0.5 },  // Body awareness, pendulation
  'visualize_movement': { heart: 0.2, mind: 0.7, body: 0.5 },  // Mental rehearsal, movement-focused

  // Mind-Body Longer (15+ min)
  'movement_coach': { heart: 0.2, mind: 0.4, body: 0.9 },  // Physical movement exercises
  'expressive_writing': { heart: 0.9, mind: 0.4, body: 0.1 },  // Deep emotional processing

  // Physical Exercise
  'biking': { heart: 0.1, mind: 0.2, body: 0.9 },  // Cardio, physical
  'dumbbell_presses': { heart: 0.1, mind: 0.2, body: 0.9 },  // Strength training
  'run': { heart: 0.2, mind: 0.3, body: 0.9 },  // Running, can be meditative
  'run_green_lake': { heart: 0.3, mind: 0.3, body: 0.9 },  // Nature connection adds heart
  'run_neighborhood': { heart: 0.2, mind: 0.3, body: 0.9 },  // Running
  'walk': { heart: 0.3, mind: 0.4, body: 0.7 },  // Walking is gentle, meditative
  'walk_green_lake': { heart: 0.4, mind: 0.4, body: 0.7 },  // Nature connection
  'walk_neighborhood': { heart: 0.3, mind: 0.4, body: 0.7 },  // Walking

  // Professional
  'coursera_module': { heart: 0.1, mind: 0.9, body: 0.0 },  // Pure learning
  'job_followup': { heart: 0.3, mind: 0.8, body: 0.0 },  // Professional communication
  'job_search': { heart: 0.2, mind: 0.8, body: 0.0 },  // Research and application

  // Additional mind-body activities (common in Notion)
  'meditation': { heart: 0.4, mind: 0.8, body: 0.2 },  // Mindfulness, awareness
  'gratitude': { heart: 0.9, mind: 0.3, body: 0.0 },  // Emotional reflection
  'journaling': { heart: 0.8, mind: 0.5, body: 0.0 },  // Writing, reflection
  'yoga': { heart: 0.3, mind: 0.4, body: 0.8 },  // Mind-body-spirit
  'stretching': { heart: 0.2, mind: 0.3, body: 0.8 },  // Physical flexibility
  'foam_rolling': { heart: 0.1, mind: 0.3, body: 0.9 },  // Physical recovery
  'cold_shower': { heart: 0.2, mind: 0.4, body: 0.8 },  // Resilience, physical
  'forgiveness_meditation': { heart: 0.9, mind: 0.5, body: 0.1 },  // Emotional healing
  'loving_kindness': { heart: 0.9, mind: 0.4, body: 0.1 },  // Compassion practice
  'body_scan': { heart: 0.3, mind: 0.6, body: 0.5 },  // Body awareness
  'progressive_relaxation': { heart: 0.3, mind: 0.5, body: 0.6 },  // Physical relaxation
}

// Default scores for activities not in the list (balanced)
const DEFAULT_SCORES = { heart: 0.33, mind: 0.33, body: 0.33 }

async function fetchAllPages() {
  const pages: any[] = []
  let hasMore = true
  let nextCursor: string | undefined

  while (hasMore) {
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
          page_size: 100,
          ...(nextCursor && { start_cursor: nextCursor })
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.status}`)
    }

    const data = await response.json()
    pages.push(...data.results)
    hasMore = data.has_more
    nextCursor = data.next_cursor
  }

  return pages
}

async function updatePage(pageId: string, heart: number, mind: number, body: number) {
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
          'Heart': { number: heart },
          'Mind': { number: mind },
          'Body': { number: body }
        }
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update page ${pageId}: ${response.status} - ${error}`)
  }

  return response.json()
}

async function main() {
  console.log('Fetching activities from Notion...')
  const pages = await fetchAllPages()
  console.log(`Found ${pages.length} activities`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const page of pages) {
    const props = page.properties
    const name = props.Name?.title?.[0]?.plain_text || 'Untitled'
    const id = props['ID']?.rich_text?.[0]?.plain_text || page.id

    // Check if already has spectrum scores
    const existingHeart = props['Heart']?.number
    const existingMind = props['Mind']?.number
    const existingBody = props['Body']?.number

    if (existingHeart !== null && existingMind !== null && existingBody !== null) {
      console.log(`Skipping "${name}" - already has spectrum scores`)
      skipped++
      continue
    }

    // Get scores from our mapping, or use default
    const idLower = id.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const nameLower = name.toLowerCase().replace(/[^a-z0-9_]/g, '_')

    let scores = SPECTRUM_SCORES[idLower] || SPECTRUM_SCORES[nameLower]

    // Try partial matches
    if (!scores) {
      for (const [key, value] of Object.entries(SPECTRUM_SCORES)) {
        if (nameLower.includes(key) || key.includes(nameLower)) {
          scores = value
          break
        }
      }
    }

    if (!scores) {
      console.log(`Using default scores for "${name}" (id: ${id})`)
      scores = DEFAULT_SCORES
    }

    try {
      await updatePage(page.id, scores.heart, scores.mind, scores.body)
      console.log(`Updated "${name}": Heart=${scores.heart}, Mind=${scores.mind}, Body=${scores.body}`)
      updated++

      // Rate limiting - Notion allows 3 requests per second
      await new Promise(resolve => setTimeout(resolve, 350))
    } catch (error) {
      console.error(`Error updating "${name}":`, error)
      errors++
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
}

main().catch(console.error)
