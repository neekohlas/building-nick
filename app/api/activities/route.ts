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

type TimeBlock = 'before6am' | 'before9am' | 'before12pm' | 'before3pm' | 'before5pm' | 'before6pm' | 'before9pm' | 'before12am' | 'beforeNoon' | 'before230pm'
type DayType = 'heavy' | 'light' | 'both'

type MindBodyType = 1 | 2 | 3 | 4 | 5

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
  default_time_block?: TimeBlock
  day_type?: DayType
  favorite?: boolean
  sort_order?: number
  mind_body_type?: MindBodyType
}

export async function GET() {
  console.log('Activities API called')
  console.log('NOTION_API_KEY present:', !!NOTION_API_KEY)
  console.log('NOTION_DATABASE_ID present:', !!NOTION_DATABASE_ID)

  // If Notion is not configured, return empty array (will use local fallback)
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    console.log('Notion not configured, returning local fallback')
    return NextResponse.json({
      success: true,
      source: 'local',
      activities: [],
      message: 'Notion not configured, using local activities'
    })
  }

  try {
    console.log('Fetching from Notion database:', NOTION_DATABASE_ID)

    // Add timeout using AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

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
        cache: 'no-store', // Disable caching while debugging
        signal: controller.signal
      }
    )

    clearTimeout(timeoutId)
    console.log('Notion response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Notion API error response:', errorText)
      throw new Error(`Notion API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Transform Notion pages to activities
    const activities: NotionActivity[] = data.results.map((page: any) => {
      const props = page.properties

      // Parse time block from Notion (e.g., "before9am" -> "before9am")
      const rawTimeBlock = props['Default Time Block']?.select?.name || ''
      const rawDayTypeValue = props['Day Type']?.select?.name || ''

      // Debug log for specific activities
      const activityName = props.Name?.title?.[0]?.plain_text || ''
      if (activityName.toLowerCase().includes('biking') || activityName.toLowerCase().includes('weight')) {
        console.log(`Activity "${activityName}": rawTimeBlock="${rawTimeBlock}", rawDayType="${rawDayTypeValue}"`)
      }

      // Debug log for video field
      if (activityName.toLowerCase().includes('forgiveness') || activityName.toLowerCase().includes('meditation')) {
        console.log(`Activity "${activityName}" Video field:`, JSON.stringify(props.Video))
        console.log(`Activity "${activityName}" all props keys:`, Object.keys(props))
      }

      const timeBlockMap: Record<string, TimeBlock> = {
        'before6am': 'before6am',
        'before 6am': 'before6am',
        'before9am': 'before9am',
        'before 9am': 'before9am',
        'before 9 am': 'before9am',
        'morning': 'before9am',
        'before12pm': 'before12pm',
        'before 12pm': 'before12pm',
        'before noon': 'beforeNoon',
        'beforenoon': 'beforeNoon',
        'before3pm': 'before3pm',
        'before 3pm': 'before3pm',
        'before 2:30pm': 'before230pm',
        'before 2:30 pm': 'before230pm',
        'before230pm': 'before230pm',
        'afternoon': 'before230pm',
        'before5pm': 'before5pm',
        'before 5pm': 'before5pm',
        'before6pm': 'before6pm',
        'before 6pm': 'before6pm',
        'before9pm': 'before9pm',
        'before 9pm': 'before9pm',
        'evening': 'before9pm',
        'before12am': 'before12am',
        'before 12am': 'before12am',
        'anytime': 'before9pm',
        'any time': 'before9pm',
        'flexible': 'before9pm'
      }
      const defaultTimeBlock = timeBlockMap[rawTimeBlock.toLowerCase()] || undefined

      // Parse day type from Notion (already read above as rawDayTypeValue)
      const rawDayType = rawDayTypeValue
      const dayTypeMap: Record<string, DayType> = {
        'heavy': 'heavy',
        'light': 'light',
        'both': 'both'
      }
      const dayType = dayTypeMap[rawDayType.toLowerCase()] || undefined

      return {
        id: props['ID']?.rich_text?.[0]?.plain_text || props['userDefined:ID']?.rich_text?.[0]?.plain_text || page.id,
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
        weekday_only: props['Weekday Only']?.checkbox || false,
        default_time_block: defaultTimeBlock,
        day_type: dayType,
        favorite: props['Favorite']?.checkbox || false,
        sort_order: props['Sort Order']?.number ?? undefined,
        // Mind-body type: 1=emotional, 2=mind with emotion, 3=balanced, 4=movement with mind, 5=movement
        mind_body_type: (() => {
          const value = props['Mind Body Type']?.number
          if (value && value >= 1 && value <= 5) return value as MindBodyType
          return undefined
        })()
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

    // Check for abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        source: 'local',
        activities: [],
        error: 'Notion API request timed out after 8 seconds'
      }, { status: 504 })
    }

    return NextResponse.json({
      success: false,
      source: 'local',
      activities: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
