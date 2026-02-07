import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'

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

// Heart-Mind-Body-Learn spectrum scores (0-1 each axis)
interface SpectrumScores {
  heart: number  // Emotional/relational
  mind: number   // Mindfulness/calming
  body: number   // Movement/physical
  learn: number  // Learning/professional
}

// Lesson types for multi-video/guide activities
interface Lesson {
  id: string
  title: string
  type: 'youtube' | 'vimeo' | 'claude_audio' | 'url' | 'instructions' | 'tool_card' | 'intro_card'
  url?: string
  prompt?: string      // For claude_audio type, references the prompt ID
  instructions?: string // For instructions type, HTML content for preset TTS
  image?: string       // For tool_card/intro_card type
  cue?: string         // For tool_card type, when to use this tool
  steps?: string[]     // For tool_card type, the steps to follow
  mappings?: { problem: string; tool: string }[] // For intro_card type
}

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
  spectrum?: SpectrumScores
  lessons?: Lesson[]
  claude_prompt?: string
  voice_guided?: boolean
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

    // Use curl as a workaround for Node.js v25 ECONNRESET issue with Notion API
    const curlResult = execFileSync('/usr/bin/curl', [
      '-s', '--max-time', '8',
      '-X', 'POST',
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      '-H', `Authorization: Bearer ${NOTION_API_KEY}`,
      '-H', 'Notion-Version: 2022-06-28',
      '-H', 'Content-Type: application/json',
      '-d', '{"page_size":100}'
    ], { encoding: 'utf8', timeout: 10000 })

    if (!curlResult || !curlResult.trim()) {
      throw new Error('Empty response from Notion API')
    }
    const data = JSON.parse(curlResult)
    if (data.object === 'error') {
      throw new Error(`Notion API error: ${data.status} - ${data.message}`)
    }
    console.log('Notion response received, results:', data.results?.length)

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
        // Before 6 AM
        'before6am': 'before6am',
        'before 6am': 'before6am',
        'before 6 am': 'before6am',
        // Before 9 AM (6-9 AM range)
        'before9am': 'before9am',
        'before 9am': 'before9am',
        'before 9 am': 'before9am',
        'morning': 'before9am',
        '6-9 am': 'before9am',
        // Before 12 PM (9 AM-12 PM range)
        'before12pm': 'beforeNoon',
        'before 12pm': 'beforeNoon',
        'before 12 pm': 'beforeNoon',
        'before noon': 'beforeNoon',
        'beforenoon': 'beforeNoon',
        '9 am-12 pm': 'beforeNoon',
        '9-12 pm': 'beforeNoon',
        // Before 2:30 PM (12-2:30 PM range)
        'before 2:30pm': 'before230pm',
        'before 2:30 pm': 'before230pm',
        'before230pm': 'before230pm',
        'afternoon': 'before230pm',
        '12-2:30 pm': 'before230pm',
        '12-2:30pm': 'before230pm',
        // Legacy mappings (map to new equivalents)
        'before3pm': 'before230pm',
        'before 3pm': 'before230pm',
        // Before 5 PM (2:30-5 PM range)
        'before5pm': 'before5pm',
        'before 5pm': 'before5pm',
        'before 5 pm': 'before5pm',
        '2:30-5 pm': 'before5pm',
        '2:30-5pm': 'before5pm',
        // Legacy before6pm maps to before5pm
        'before6pm': 'before5pm',
        'before 6pm': 'before5pm',
        // Before 9 PM (5-9 PM range)
        'before9pm': 'before9pm',
        'before 9pm': 'before9pm',
        'before 9 pm': 'before9pm',
        'evening': 'before9pm',
        '5-9 pm': 'before9pm',
        '5-9pm': 'before9pm',
        // Legacy before12am maps to before9pm
        'before12am': 'before9pm',
        'before 12am': 'before9pm',
        // Flexible/anytime
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

      // Handle Steps column - convert to HTML instructions format
      // Steps can be rich_text with newlines, or we fall back to Instructions
      let instructions = ''

      // First try "Steps" column (preferred for audio mode)
      const stepsRichText = props.Steps?.rich_text || []
      if (stepsRichText.length > 0) {
        // Combine all rich text blocks
        const stepsText = stepsRichText.map((rt: any) => rt.plain_text || '').join('')

        if (stepsText.trim()) {
          // Split by newlines and convert to HTML list
          const stepLines = stepsText.split('\n').filter((line: string) => line.trim())
          if (stepLines.length > 0) {
            instructions = `<h4>Instructions</h4>\n<ol>\n${stepLines.map((step: string) => `<li>${step.trim()}</li>`).join('\n')}\n</ol>`
          }
        }
      }

      // Fall back to Instructions column if no Steps
      if (!instructions) {
        const rawInstructions = props.Instructions?.rich_text?.[0]?.plain_text || ''
        // If it already looks like HTML, use as-is; otherwise wrap in basic structure
        if (rawInstructions.includes('<')) {
          instructions = rawInstructions
        } else if (rawInstructions.trim()) {
          // Plain text - convert newlines to list items
          const lines = rawInstructions.split('\n').filter((line: string) => line.trim())
          if (lines.length > 1) {
            instructions = `<h4>Instructions</h4>\n<ol>\n${lines.map((line: string) => `<li>${line.trim()}</li>`).join('\n')}\n</ol>`
          } else {
            instructions = `<p>${rawInstructions}</p>`
          }
        }
      }

      return {
        id: props['ID']?.rich_text?.[0]?.plain_text || props['userDefined:ID']?.rich_text?.[0]?.plain_text || page.id,
        name: props.Name?.title?.[0]?.plain_text || 'Untitled',
        description: props.Description?.rich_text?.[0]?.plain_text || '',
        category: props.Category?.select?.name?.toLowerCase().replace('-', '_') || 'mind_body',
        duration: props.Duration?.number || 5,
        instructions,
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
        })(),
        // Heart-Mind-Body-Learn spectrum (0-1 for each axis)
        spectrum: (() => {
          const heart = props['Heart']?.number
          const mind = props['Mind']?.number
          const body = props['Body']?.number
          const learn = props['Learn']?.number
          // Only return spectrum if at least one value is set
          if (heart !== undefined || mind !== undefined || body !== undefined || learn !== undefined) {
            return {
              heart: typeof heart === 'number' ? Math.max(0, Math.min(1, heart)) : 0,
              mind: typeof mind === 'number' ? Math.max(0, Math.min(1, mind)) : 0,
              body: typeof body === 'number' ? Math.max(0, Math.min(1, body)) : 0,
              learn: typeof learn === 'number' ? Math.max(0, Math.min(1, learn)) : 0,
            }
          }
          return undefined
        })(),
        // Lessons - JSON array of video/audio lesson objects
        // Supports compact format with short keys to fit within Notion's 2000 char limit
        // Concatenates all rich_text blocks (JSON may be split across multiple blocks)
        lessons: (() => {
          const richText = props['Lessons']?.rich_text
          if (!richText?.length) return undefined
          const lessonsJson = richText.map((b: any) => b.plain_text || '').join('')
          if (!lessonsJson) return undefined
          try {
            const parsed = JSON.parse(lessonsJson)
            if (Array.isArray(parsed)) {
              // Expand short keys to full format if needed
              return parsed.map((lesson: any) => {
                // Check if using compact format (short keys)
                if (lesson.i || lesson.y) {
                  return {
                    id: lesson.i || lesson.id,
                    title: lesson.t || lesson.title,
                    type: lesson.y || lesson.type,
                    url: lesson.u || lesson.url,
                    prompt: lesson.p || lesson.prompt,
                    instructions: lesson.n || lesson.instructions,
                    image: lesson.m || lesson.image,
                    cue: lesson.c || lesson.cue,
                    steps: lesson.s || lesson.steps,
                    fightingAgainst: lesson.fa || lesson.fightingAgainst,
                    higherForce: lesson.hf || lesson.higherForce,
                    otherUses: lesson.ou || lesson.otherUses,
                    // mappings for intro_card - expand from {p,t} to {problem,tool}
                    mappings: lesson.mp ? lesson.mp.map((m: any) => ({
                      problem: m.p || m.problem,
                      tool: m.t || m.tool
                    })) : lesson.mappings
                  }
                }
                return lesson
              }) as Lesson[]
            }
          } catch (e) {
            console.error(`Failed to parse lessons JSON for activity "${activityName}":`, e)
          }
          return undefined
        })(),
        // Claude Prompt - custom prompt for Claude-generated audio guides
        claude_prompt: props['Claude Prompt']?.rich_text?.[0]?.plain_text || undefined,
        // Voice Guided - whether this activity has an audio guide
        voice_guided: props['Voice Guided']?.checkbox || false
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
