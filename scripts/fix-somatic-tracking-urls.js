/**
 * Fix Somatic Tracking video URLs in Notion
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY
const DATABASE_ID = process.env.NOTION_DATABASE_ID

async function findSomaticTrackingPage() {
  const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'ID',
        rich_text: {
          equals: 'somatic_tracking'
        }
      }
    })
  })

  const data = await response.json()
  return data.results?.[0]
}

async function updateLessons(pageId) {
  const correctLessons = [
    {
      id: 'st_clouds',
      title: 'Clouds Metaphor',
      type: 'vimeo',
      url: 'https://vimeo.com/715226740/a262662ffb'
    },
    {
      id: 'st_aquarium',
      title: 'Aquarium Metaphor',
      type: 'vimeo',
      url: 'https://vimeo.com/715230375/ffd1da58e8'
    },
    {
      id: 'st_car',
      title: 'Neighborhood Exploration',
      type: 'vimeo',
      url: 'https://vimeo.com/715225171/d40b5be2c2'
    },
    {
      id: 'st_claude',
      title: 'Claude Audio Guide',
      type: 'claude_audio',
      prompt: 'somatic_tracking'
    }
  ]

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        'Lessons': {
          rich_text: [{
            type: 'text',
            text: { content: JSON.stringify(correctLessons) }
          }]
        }
      }
    })
  })

  return response.ok
}

async function main() {
  console.log('Finding Somatic Tracking activity...')

  const page = await findSomaticTrackingPage()
  if (!page) {
    console.error('Somatic Tracking activity not found!')
    return
  }

  console.log('Found page:', page.id)
  console.log('Updating lessons with correct Vimeo URLs...')

  const success = await updateLessons(page.id)
  if (success) {
    console.log('✓ Somatic Tracking lessons updated successfully!')
  } else {
    console.error('Failed to update lessons')
  }
}

main().catch(console.error)
