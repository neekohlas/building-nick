import { NextResponse } from 'next/server'

/**
 * Notion API Integration for Building Nick
 * Fetches activities from Notion database
 * 
 * To use this, you need to:
 * 1. Create a Notion integration at https://www.notion.so/my-integrations
 * 2. Share your activities database with the integration
 * 3. Set NOTION_API_KEY and NOTION_DATABASE_ID environment variables
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID

interface NotionActivity {
  id: string
  name: string
  description: string
  category: string
  duration: number
  instructions: string
  quick?: boolean
  link?: string
  video?: string
  weather_dependent?: boolean
  outdoor?: boolean
  weekday_only?: boolean
}

export async function GET() {
  // If Notion is not configured, return empty array (will use local fallback)
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    return NextResponse.json({
      success: true,
      source: 'local',
      activities: [],
      message: 'Notion not configured, using local activities'
    })
  }

  try {
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
          page_size: 100
        }),
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform Notion pages to activities
    const activities: NotionActivity[] = data.results.map((page: any) => {
      const props = page.properties

      return {
        id: props.ID?.rich_text?.[0]?.plain_text || page.id,
        name: props.Name?.title?.[0]?.plain_text || 'Untitled',
        description: props.Description?.rich_text?.[0]?.plain_text || '',
        category: props.Category?.select?.name?.toLowerCase().replace('-', '_') || 'mind_body',
        duration: props.Duration?.number || 5,
        instructions: props.Instructions?.rich_text?.[0]?.plain_text || '',
        quick: props.Quick?.checkbox || false,
        link: props.Link?.url || undefined,
        video: props.Video?.url || undefined,
        weather_dependent: props['Weather Dependent']?.checkbox || false,
        outdoor: props.Outdoor?.checkbox || false,
        weekday_only: props['Weekday Only']?.checkbox || false
      }
    })

    return NextResponse.json({
      success: true,
      source: 'notion',
      activities,
      count: activities.length
    })
  } catch (error) {
    console.error('Error fetching from Notion:', error)

    return NextResponse.json({
      success: false,
      source: 'local',
      activities: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
