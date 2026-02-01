#!/usr/bin/env node

/**
 * Script to update Notion activities with Learn scores
 * and adjust Mind scores where appropriate
 *
 * Run with: node scripts/update-learn-scores.js
 */

// Load from environment variable or .env.local file
require('dotenv').config({ path: '.env.local' });
const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!NOTION_API_KEY) {
  console.error('Error: NOTION_API_KEY not found. Set it in .env.local or as an environment variable.');
  process.exit(1);
}

// Mapping of activity names to their new scores
// Format: { learn: number, mind?: number } - mind is optional, only if it needs adjustment
const SCORE_UPDATES = {
  // High Learn activities (professional/learning focus)
  'Coursera PM Course': { learn: 0.95, mind: 0.2 },
  'Job Search - New Applications': { learn: 0.8, mind: 0.3 },
  'Job Search - Follow Up': { learn: 0.7, mind: 0.3 },
  'Lin Health App Module': { learn: 0.7, mind: 0.5 },

  // Mixed Learn/Mind activities
  'WOOP': { learn: 0.5, mind: 0.7 },
  'Processing Emotions - Therapy in a Nutshell': { learn: 0.5, mind: 0.4 },
  'Visualize Graded Movement': { learn: 0.4, mind: 0.5 },

  // Pure mindfulness activities (Mind stays high, Learn is 0 or very low)
  'RAIN Meditation': { learn: 0.1 },
  'Self Compassion Meditation': { learn: 0.1 },
  'Forgiveness Meditation': { learn: 0.1 },
  'Deep Breathing / Physiological Sigh': { learn: 0 },
  'External Orienting': { learn: 0 },
  'Internal Orienting / Pendulation': { learn: 0 },
  'Body Scan (Hargrove Ex. 1)': { learn: 0 },
  'Breathing Exercise (Hargrove Ex. 3)': { learn: 0 },
  'Yoga Nidra': { learn: 0 },
  'Somatic Tracking with Emotions': { learn: 0.1 },

  // Emotional/Heart activities (Learn is 0)
  'Unsent Letter / Expressive Writing': { learn: 0 },
  'Emotional Time Traveling': { learn: 0 },
  'EAET (Emotional Awareness Expression Therapy)': { learn: 0.1 },

  // Movement/Body activities (Learn is 0)
  'Qigong': { learn: 0 },
  'Cat/Cow (Hargrove Ex. 4)': { learn: 0 },
  'Lengthening the Spine (Hargrove Ex. 2)': { learn: 0 },
  'Intuitive Movement': { learn: 0 },
  'Feldenkrais': { learn: 0.1 },
  'Curiosity Yoga': { learn: 0 },
  'Core Exploration': { learn: 0 },

  // Physical activities (Learn is 0)
  'Weights / Strength Training': { learn: 0 },
  'Biking': { learn: 0 },
  'Walk - Neighborhood': { learn: 0 },
  'Walk - Green Lake': { learn: 0 },
  'Run': { learn: 0 },
  'PT / Home Exercise Routine': { learn: 0 },
};

async function updatePage(pageId, name, scores) {
  const properties = {
    Learn: { number: scores.learn }
  };

  // Only update Mind if specified
  if (scores.mind !== undefined) {
    properties.Mind = { number: scores.mind };
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ properties })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to update "${name}":`, error);
    return false;
  }

  const mindUpdate = scores.mind !== undefined ? `, Mind: ${scores.mind}` : '';
  console.log(`✓ Updated "${name}" - Learn: ${scores.learn}${mindUpdate}`);
  return true;
}

async function main() {
  // First, get all pages
  const response = await fetch(
    'https://api.notion.com/v1/databases/2f34ff735e318012b520fe1dcaab691f/query',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page_size: 100 })
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch pages:', await response.text());
    process.exit(1);
  }

  const data = await response.json();

  console.log(`Found ${data.results.length} activities\n`);
  console.log('Updating Learn scores...\n');

  let updated = 0;
  let skipped = 0;

  for (const page of data.results) {
    const name = page.properties.Name?.title?.[0]?.plain_text;
    if (!name) continue;

    const scores = SCORE_UPDATES[name];
    if (scores) {
      const success = await updatePage(page.id, name, scores);
      if (success) updated++;
    } else {
      // Default: set Learn to 0 for activities not in the mapping
      const success = await updatePage(page.id, name, { learn: 0 });
      if (success) {
        console.log(`  (default Learn: 0 for "${name}")`);
        updated++;
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone! Updated ${updated} activities.`);
}

main().catch(console.error);
