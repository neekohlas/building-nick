// Script to add Lessons and Claude Prompt fields to Notion database
// Run with: node scripts/add-lessons-field.js
// Set environment variables: NOTION_API_KEY, NOTION_DATABASE_ID

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID environment variables are required');
  process.exit(1);
}

async function addFields() {
  console.log('Adding Lessons and Claude Prompt fields to Notion database...');

  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        // Lessons field - stores JSON array of lesson objects
        // Format: [{"id": "clouds", "title": "Clouds Metaphor", "type": "vimeo", "url": "..."}]
        'Lessons': { rich_text: {} },
        // Claude Prompt field - custom prompt for Claude-generated audio guides
        'Claude Prompt': { rich_text: {} }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to add fields:', response.status, error);
    process.exit(1);
  }

  const data = await response.json();
  const props = Object.keys(data.properties);
  console.log('Fields added successfully!');
  console.log('Database now has these new properties:', props.filter(p => ['Lessons', 'Claude Prompt'].includes(p)));
}

addFields().catch(console.error);
