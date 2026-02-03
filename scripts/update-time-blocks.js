// Script to update Default Time select options in Notion database
// Run with: node scripts/update-time-blocks.js
// Set environment variables: NOTION_API_KEY, NOTION_DATABASE_ID

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID environment variables are required');
  process.exit(1);
}

async function updateTimeBlocks() {
  console.log('Updating Default Time select options in Notion database...');

  // First, get current database schema to see existing options
  const getResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
    }
  });

  if (!getResponse.ok) {
    const error = await getResponse.text();
    console.error('Failed to get database:', getResponse.status, error);
    process.exit(1);
  }

  const dbData = await getResponse.json();
  const defaultTimeProperty = dbData.properties['Default Time'];

  if (!defaultTimeProperty) {
    console.log('Default Time property not found. Creating it...');
  } else {
    console.log('Current Default Time options:', defaultTimeProperty.select?.options?.map(o => o.name) || 'none');
  }

  // Update with the correct time block options
  // Pattern: Before 6 AM, 9 AM, 12 PM, 2:30 PM, 5 PM, 9 PM
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        'Default Time': {
          select: {
            options: [
              { name: 'Before 6 AM', color: 'gray' },
              { name: 'Before 9 AM', color: 'blue' },
              { name: 'Before 12 PM', color: 'yellow' },
              { name: 'Before 2:30 PM', color: 'orange' },
              { name: 'Before 5 PM', color: 'red' },
              { name: 'Before 9 PM', color: 'purple' }
            ]
          }
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to update database:', response.status, error);
    process.exit(1);
  }

  const data = await response.json();
  const updatedOptions = data.properties['Default Time']?.select?.options?.map(o => o.name);
  console.log('Default Time options updated successfully!');
  console.log('New options:', updatedOptions);
}

updateTimeBlocks().catch(console.error);
