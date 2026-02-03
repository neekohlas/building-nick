/**
 * Script to populate Heart/Mind/Body spectrum scores in Notion
 * Run with: node scripts/populate-spectrum-scores.js
 * Set environment variables: NOTION_API_KEY, NOTION_DATABASE_ID
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID environment variables are required');
  process.exit(1);
}

// Initial spectrum scores for activities (based on my judgment)
// Heart: Emotional/relational (journaling, gratitude, connection)
// Mind: Cognitive/focus (education, meditation, planning)
// Body: Movement/physical (exercises, stretches, outdoor)
const SPECTRUM_SCORES = {
  // Mind-Body Quick (1-5 min)
  'lin_health_education': { heart: 0.2, mind: 0.9, body: 0.1 },
  'lin health education': { heart: 0.2, mind: 0.9, body: 0.1 },
  'breathing': { heart: 0.3, mind: 0.6, body: 0.4 },
  'breathing exercises': { heart: 0.3, mind: 0.6, body: 0.4 },
  'external_orienting': { heart: 0.2, mind: 0.7, body: 0.3 },
  'external orienting': { heart: 0.2, mind: 0.7, body: 0.3 },
  'internal_orienting': { heart: 0.4, mind: 0.5, body: 0.5 },
  'internal orienting': { heart: 0.4, mind: 0.5, body: 0.5 },
  'visualize_movement': { heart: 0.2, mind: 0.7, body: 0.5 },
  'visualize graded movement': { heart: 0.2, mind: 0.7, body: 0.5 },

  // Mind-Body Longer (15+ min)
  'movement_coach': { heart: 0.2, mind: 0.4, body: 0.9 },
  'movement coach': { heart: 0.2, mind: 0.4, body: 0.9 },
  'movement coach exercise': { heart: 0.2, mind: 0.4, body: 0.9 },
  'expressive_writing': { heart: 0.9, mind: 0.4, body: 0.1 },
  'expressive writing': { heart: 0.9, mind: 0.4, body: 0.1 },

  // Physical Exercise
  'biking': { heart: 0.1, mind: 0.2, body: 0.9 },
  'stationary biking': { heart: 0.1, mind: 0.2, body: 0.9 },
  'dumbbell_presses': { heart: 0.1, mind: 0.2, body: 0.9 },
  'dumbbell presses': { heart: 0.1, mind: 0.2, body: 0.9 },
  'weight training': { heart: 0.1, mind: 0.2, body: 0.9 },
  'run': { heart: 0.2, mind: 0.3, body: 0.9 },
  'running': { heart: 0.2, mind: 0.3, body: 0.9 },
  'run_green_lake': { heart: 0.3, mind: 0.3, body: 0.9 },
  'run (green lake)': { heart: 0.3, mind: 0.3, body: 0.9 },
  'run_neighborhood': { heart: 0.2, mind: 0.3, body: 0.9 },
  'run (neighborhood)': { heart: 0.2, mind: 0.3, body: 0.9 },
  'walk': { heart: 0.3, mind: 0.4, body: 0.7 },
  'walking': { heart: 0.3, mind: 0.4, body: 0.7 },
  'walk_green_lake': { heart: 0.4, mind: 0.4, body: 0.7 },
  'walk (green lake)': { heart: 0.4, mind: 0.4, body: 0.7 },
  'walk_neighborhood': { heart: 0.3, mind: 0.4, body: 0.7 },
  'walk (neighborhood)': { heart: 0.3, mind: 0.4, body: 0.7 },

  // Professional
  'coursera_module': { heart: 0.1, mind: 0.9, body: 0.0 },
  'coursera modules': { heart: 0.1, mind: 0.9, body: 0.0 },
  'job_followup': { heart: 0.3, mind: 0.8, body: 0.0 },
  'job application follow-up': { heart: 0.3, mind: 0.8, body: 0.0 },
  'job_search': { heart: 0.2, mind: 0.8, body: 0.0 },
  'job search': { heart: 0.2, mind: 0.8, body: 0.0 },
  'job search / new application': { heart: 0.2, mind: 0.8, body: 0.0 },

  // Additional mind-body activities
  'meditation': { heart: 0.4, mind: 0.8, body: 0.2 },
  'gratitude': { heart: 0.9, mind: 0.3, body: 0.0 },
  'gratitude practice': { heart: 0.9, mind: 0.3, body: 0.0 },
  'journaling': { heart: 0.8, mind: 0.5, body: 0.0 },
  'yoga': { heart: 0.3, mind: 0.4, body: 0.8 },
  'stretching': { heart: 0.2, mind: 0.3, body: 0.8 },
  'foam_rolling': { heart: 0.1, mind: 0.3, body: 0.9 },
  'foam rolling': { heart: 0.1, mind: 0.3, body: 0.9 },
  'cold_shower': { heart: 0.2, mind: 0.4, body: 0.8 },
  'cold shower': { heart: 0.2, mind: 0.4, body: 0.8 },
  'forgiveness_meditation': { heart: 0.9, mind: 0.5, body: 0.1 },
  'forgiveness meditation': { heart: 0.9, mind: 0.5, body: 0.1 },
  'loving_kindness': { heart: 0.9, mind: 0.4, body: 0.1 },
  'loving kindness': { heart: 0.9, mind: 0.4, body: 0.1 },
  'body_scan': { heart: 0.3, mind: 0.6, body: 0.5 },
  'body scan': { heart: 0.3, mind: 0.6, body: 0.5 },
  'progressive_relaxation': { heart: 0.3, mind: 0.5, body: 0.6 },
  'progressive relaxation': { heart: 0.3, mind: 0.5, body: 0.6 },
  'progressive muscle relaxation': { heart: 0.3, mind: 0.5, body: 0.6 },

  // Hargrove exercises
  'hargrove': { heart: 0.2, mind: 0.4, body: 0.9 },
  'squat': { heart: 0.1, mind: 0.2, body: 0.95 },
  'hip': { heart: 0.1, mind: 0.3, body: 0.9 },
  'spine': { heart: 0.2, mind: 0.4, body: 0.85 },
  'shoulder': { heart: 0.1, mind: 0.3, body: 0.9 },
  'neck': { heart: 0.2, mind: 0.4, body: 0.8 },
};

// Default scores for activities not in the list
const DEFAULT_SCORES = { heart: 0.33, mind: 0.33, body: 0.33 };

async function fetchAllPages() {
  const pages = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const body = { page_size: 100 };
    if (nextCursor) body.start_cursor = nextCursor;

    const response = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.status}`);
    }

    const data = await response.json();
    pages.push(...data.results);
    hasMore = data.has_more;
    nextCursor = data.next_cursor;
  }

  return pages;
}

async function updatePage(pageId, heart, mind, body) {
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
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update page ${pageId}: ${response.status} - ${error}`);
  }

  return response.json();
}

function findScores(name, id) {
  const nameLower = name.toLowerCase().trim();
  const idLower = (id || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // Direct match
  if (SPECTRUM_SCORES[nameLower]) return SPECTRUM_SCORES[nameLower];
  if (SPECTRUM_SCORES[idLower]) return SPECTRUM_SCORES[idLower];

  // Partial match
  for (const [key, value] of Object.entries(SPECTRUM_SCORES)) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return value;
    }
  }

  return null;
}

async function main() {
  console.log('Fetching activities from Notion...');
  const pages = await fetchAllPages();
  console.log(`Found ${pages.length} activities\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const page of pages) {
    const props = page.properties;
    const name = props.Name?.title?.[0]?.plain_text || 'Untitled';
    const id = props['ID']?.rich_text?.[0]?.plain_text || '';

    // Check if already has spectrum scores
    const existingHeart = props['Heart']?.number;
    const existingMind = props['Mind']?.number;
    const existingBody = props['Body']?.number;

    if (existingHeart !== null && existingHeart !== undefined) {
      console.log(`Skipping "${name}" - already has spectrum scores`);
      skipped++;
      continue;
    }

    // Get scores from our mapping
    let scores = findScores(name, id);

    if (!scores) {
      console.log(`Using default scores for "${name}" (no match found)`);
      scores = DEFAULT_SCORES;
    }

    try {
      await updatePage(page.id, scores.heart, scores.mind, scores.body);
      console.log(`Updated "${name}": Heart=${scores.heart}, Mind=${scores.mind}, Body=${scores.body}`);
      updated++;

      // Rate limiting - Notion allows 3 requests per second
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (error) {
      console.error(`Error updating "${name}":`, error.message);
      errors++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
