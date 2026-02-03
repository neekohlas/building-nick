// Script to add Heart/Mind/Body columns to Notion database
// Set environment variables: NOTION_API_KEY, NOTION_DATABASE_ID
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID environment variables are required');
  process.exit(1);
}

async function addColumns() {
  console.log('Adding Heart/Mind/Body columns to Notion database...');

  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        Heart: { number: { format: 'number' } },
        Mind: { number: { format: 'number' } },
        Body: { number: { format: 'number' } }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to add columns:', response.status, error);
    process.exit(1);
  }

  const data = await response.json();
  const props = Object.keys(data.properties);
  console.log('Columns added successfully!');
  console.log('Database now has these properties:', props.filter(p => ['Heart', 'Mind', 'Body'].includes(p)));
}

addColumns().catch(console.error);
