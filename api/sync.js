/**
 * Vercel Serverless Function: Sync user data with Notion
 *
 * Stores completions and weekly plans in a Notion database.
 *
 * Environment Variables Required:
 * - NOTION_API_KEY: Your Notion integration secret
 * - NOTION_SYNC_DATABASE_ID: The ID of your sync/completions database
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_SYNC_DATABASE_ID = process.env.NOTION_SYNC_DATABASE_ID;

  if (!NOTION_API_KEY || !NOTION_SYNC_DATABASE_ID) {
    return res.status(500).json({
      error: 'Notion sync configuration missing',
      message: 'Please set NOTION_API_KEY and NOTION_SYNC_DATABASE_ID environment variables'
    });
  }

  try {
    if (req.method === 'GET') {
      // Load all completions and plans from Notion
      return await handleGet(req, res, NOTION_API_KEY, NOTION_SYNC_DATABASE_ID);
    } else if (req.method === 'POST') {
      // Save completions and plans to Notion
      return await handlePost(req, res, NOTION_API_KEY, NOTION_SYNC_DATABASE_ID);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
}

/**
 * GET: Load all user data from Notion
 */
async function handleGet(req, res, apiKey, databaseId) {
  const userId = req.query.userId || 'default';

  // Query all records for this user
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'User ID',
        rich_text: {
          equals: userId
        }
      },
      sorts: [
        {
          property: 'Date',
          direction: 'descending'
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Notion API error:', errorData);
    return res.status(response.status).json({
      error: 'Failed to load data',
      details: errorData
    });
  }

  const data = await response.json();

  // Parse completions and plans from results
  const completions = [];
  const weeklyPlans = {};
  const dailySchedules = {};

  for (const page of data.results) {
    const props = page.properties;
    const type = getSelectValue(props.Type);
    const dateStr = getTextValue(props.Date);

    if (type === 'completion') {
      completions.push({
        id: page.id,
        date: dateStr,
        activityId: getTextValue(props['Activity ID']),
        timeBlock: getTextValue(props['Time Block']) || 'anytime',
        customName: getTextValue(props['Custom Name']),
        customDuration: getNumberValue(props['Custom Duration']),
        completedAt: getTextValue(props['Completed At']) || page.created_time
      });
    } else if (type === 'weekly_plan') {
      const weekStart = dateStr;
      weeklyPlans[weekStart] = {
        weekStart,
        mindBodyFocus: JSON.parse(getTextValue(props.Data) || '[]'),
        physicalDays: []
      };
    } else if (type === 'daily_schedule') {
      dailySchedules[dateStr] = JSON.parse(getTextValue(props.Data) || '{}');
    }
  }

  return res.status(200).json({
    success: true,
    completions,
    weeklyPlans,
    dailySchedules,
    lastSynced: new Date().toISOString()
  });
}

/**
 * POST: Save user data to Notion
 */
async function handlePost(req, res, apiKey, databaseId) {
  const { userId = 'default', completions = [], weeklyPlans = {}, dailySchedules = {} } = req.body;

  const results = {
    created: 0,
    errors: []
  };

  // Save completions
  for (const completion of completions) {
    // Check if this completion already exists (by date + activityId)
    const exists = await checkCompletionExists(apiKey, databaseId, userId, completion.date, completion.activityId);

    if (!exists) {
      const created = await createCompletionRecord(apiKey, databaseId, userId, completion);
      if (created) {
        results.created++;
      } else {
        results.errors.push(`Failed to create completion for ${completion.activityId} on ${completion.date}`);
      }
    }
  }

  // Save weekly plans
  for (const [weekStart, plan] of Object.entries(weeklyPlans)) {
    await upsertRecord(apiKey, databaseId, userId, 'weekly_plan', weekStart, JSON.stringify(plan.mindBodyFocus || []));
  }

  // Save daily schedules
  for (const [dateStr, schedule] of Object.entries(dailySchedules)) {
    await upsertRecord(apiKey, databaseId, userId, 'daily_schedule', dateStr, JSON.stringify(schedule));
  }

  return res.status(200).json({
    success: true,
    ...results,
    syncedAt: new Date().toISOString()
  });
}

/**
 * Check if a completion already exists
 */
async function checkCompletionExists(apiKey, databaseId, userId, date, activityId) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'User ID', rich_text: { equals: userId } },
          { property: 'Type', select: { equals: 'completion' } },
          { property: 'Date', rich_text: { equals: date } },
          { property: 'Activity ID', rich_text: { equals: activityId } }
        ]
      }
    })
  });

  if (!response.ok) return false;
  const data = await response.json();
  return data.results.length > 0;
}

/**
 * Create a completion record in Notion
 */
async function createCompletionRecord(apiKey, databaseId, userId, completion) {
  const properties = {
    'User ID': { rich_text: [{ text: { content: userId } }] },
    'Type': { select: { name: 'completion' } },
    'Date': { rich_text: [{ text: { content: completion.date } }] },
    'Activity ID': { rich_text: [{ text: { content: completion.activityId } }] },
    'Time Block': { rich_text: [{ text: { content: completion.timeBlock || 'anytime' } }] },
    'Completed At': { rich_text: [{ text: { content: completion.completedAt || new Date().toISOString() } }] }
  };

  if (completion.customName) {
    properties['Custom Name'] = { rich_text: [{ text: { content: completion.customName } }] };
  }
  if (completion.customDuration) {
    properties['Custom Duration'] = { number: completion.customDuration };
  }

  // Add a title (required by Notion)
  properties['Name'] = { title: [{ text: { content: `${completion.date} - ${completion.activityId}` } }] };

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties
    })
  });

  return response.ok;
}

/**
 * Upsert a record (create or update)
 */
async function upsertRecord(apiKey, databaseId, userId, type, date, data) {
  // First check if record exists
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'User ID', rich_text: { equals: userId } },
          { property: 'Type', select: { equals: type } },
          { property: 'Date', rich_text: { equals: date } }
        ]
      }
    })
  });

  if (!response.ok) return false;
  const queryData = await response.json();

  if (queryData.results.length > 0) {
    // Update existing
    const pageId = queryData.results[0].id;
    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          'Data': { rich_text: [{ text: { content: data } }] }
        }
      })
    });
    return updateResponse.ok;
  } else {
    // Create new
    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          'Name': { title: [{ text: { content: `${type} - ${date}` } }] },
          'User ID': { rich_text: [{ text: { content: userId } }] },
          'Type': { select: { name: type } },
          'Date': { rich_text: [{ text: { content: date } }] },
          'Data': { rich_text: [{ text: { content: data } }] }
        }
      })
    });
    return createResponse.ok;
  }
}

// Helper functions
function getTextValue(prop) {
  if (!prop) return null;
  if (prop.type === 'rich_text' && prop.rich_text.length) {
    return prop.rich_text.map(t => t.plain_text).join('');
  }
  if (prop.type === 'title' && prop.title.length) {
    return prop.title.map(t => t.plain_text).join('');
  }
  return null;
}

function getSelectValue(prop) {
  if (!prop || prop.type !== 'select' || !prop.select) return null;
  return prop.select.name;
}

function getNumberValue(prop) {
  if (!prop || prop.type !== 'number') return null;
  return prop.number;
}
