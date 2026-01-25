/**
 * Vercel Serverless Function: Fetch activities from Notion
 *
 * Environment Variables Required:
 * - NOTION_API_KEY: Your Notion integration secret
 * - NOTION_DATABASE_ID: The ID of your activities database
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    return res.status(500).json({
      error: 'Notion configuration missing',
      message: 'Please set NOTION_API_KEY and NOTION_DATABASE_ID environment variables'
    });
  }

  try {
    // Query the Notion database
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'Active',
          checkbox: {
            equals: true
          }
        },
        sorts: [
          {
            property: 'Category',
            direction: 'ascending'
          },
          {
            property: 'Name',
            direction: 'ascending'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API error:', errorData);
      return res.status(response.status).json({
        error: 'Notion API error',
        details: errorData
      });
    }

    const data = await response.json();

    // Transform Notion data to our activity format
    const activities = {};

    for (const page of data.results) {
      const props = page.properties;

      // Extract properties (adjust these based on your Notion database schema)
      const id = getTextProperty(props.ID) || page.id.replace(/-/g, '');
      const name = getTitleProperty(props.Name);
      const description = getTextProperty(props.Description) || '';
      const category = getSelectProperty(props.Category) || 'mind_body';
      const duration = getNumberProperty(props.Duration) || 5;
      const instructions = getTextProperty(props.Instructions) || '';
      const link = getUrlProperty(props.Link) || null;
      const video = getUrlProperty(props.Video) || null;
      const quick = getCheckboxProperty(props.Quick) || false;
      const weatherDependent = getCheckboxProperty(props['Weather Dependent']) || false;
      const outdoor = getCheckboxProperty(props.Outdoor) || false;
      const weekdayOnly = getCheckboxProperty(props['Weekday Only']) || false;
      const pairsWith = getTextProperty(props['Pairs With']) || null;
      const frequency = getSelectProperty(props.Frequency) || null;
      const steps = getTextProperty(props.Steps) || null;
      const voiceGuidance = getCheckboxProperty(props['Voice Guidance']) || false;

      if (!name) continue;

      // Parse steps from numbered markdown into array
      const parsedSteps = steps ? parseStepsFromMarkdown(steps) : null;

      activities[id] = {
        id,
        name,
        description,
        category: category.toLowerCase().replace(/\s+/g, '_'),
        duration,
        instructions: instructions ? `<h4>Instructions</h4>${instructions}` : null,
        link,
        video,
        quick,
        weather_dependent: weatherDependent,
        outdoor,
        weekday_only: weekdayOnly,
        pairs_with: pairsWith,
        frequency,
        steps: parsedSteps,
        hasVoiceGuide: voiceGuidance && parsedSteps && parsedSteps.length > 0
      };
    }

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json({
      success: true,
      activities,
      count: Object.keys(activities).length,
      lastFetched: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching from Notion:', error);
    return res.status(500).json({
      error: 'Failed to fetch activities',
      message: error.message
    });
  }
}

// Helper functions to extract Notion property values

function getTitleProperty(prop) {
  if (!prop || prop.type !== 'title' || !prop.title.length) return null;
  return prop.title.map(t => t.plain_text).join('');
}

function getTextProperty(prop) {
  if (!prop) return null;
  if (prop.type === 'rich_text' && prop.rich_text.length) {
    return prop.rich_text.map(t => t.plain_text).join('');
  }
  return null;
}

function getNumberProperty(prop) {
  if (!prop || prop.type !== 'number') return null;
  return prop.number;
}

function getSelectProperty(prop) {
  if (!prop || prop.type !== 'select' || !prop.select) return null;
  return prop.select.name;
}

function getCheckboxProperty(prop) {
  if (!prop || prop.type !== 'checkbox') return false;
  return prop.checkbox;
}

function getUrlProperty(prop) {
  if (!prop || prop.type !== 'url') return null;
  return prop.url;
}

/**
 * Parse numbered markdown steps into an array
 * Handles formats like:
 * "1. Step one\n2. Step two\n3. Step three"
 */
function parseStepsFromMarkdown(text) {
  if (!text || typeof text !== 'string') return null;

  // Split by numbered list pattern (e.g., "1. ", "2. ", etc.)
  const lines = text.split(/\n/).filter(line => line.trim());
  const steps = [];

  for (const line of lines) {
    // Match lines starting with a number followed by a period or parenthesis
    const match = line.match(/^\d+[\.\)]\s*(.+)/);
    if (match) {
      steps.push(match[1].trim());
    }
  }

  return steps.length > 0 ? steps : null;
}
