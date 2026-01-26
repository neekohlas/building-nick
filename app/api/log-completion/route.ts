import { NextRequest, NextResponse } from 'next/server'

/**
 * Log activity completion to Notion
 * This allows syncing completions to a Notion database for backup/analysis
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY
const NOTION_COMPLETIONS_DB = process.env.NOTION_COMPLETIONS_DATABASE_ID

export async function POST(request: NextRequest) {
  // If Notion is not configured, just acknowledge
  if (!NOTION_API_KEY || !NOTION_COMPLETIONS_DB) {
    return NextResponse.json({
      success: true,
      synced: false,
      message: 'Notion not configured, completion saved locally only'
    })
  }

  try {
    const { date, activityId, activityName, timeBlock, completedAt } = await request.json()

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_COMPLETIONS_DB },
        properties: {
          Date: {
            date: { start: date }
          },
          Activity: {
            title: [{ text: { content: activityName || activityId } }]
          },
          'Activity ID': {
            rich_text: [{ text: { content: activityId } }]
          },
          'Time Block': {
            select: { name: timeBlock }
          },
          'Completed At': {
            date: { start: completedAt }
          }
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to log to Notion')
    }

    return NextResponse.json({
      success: true,
      synced: true
    })
  } catch (error) {
    console.error('Error logging completion to Notion:', error)

    return NextResponse.json({
      success: true,
      synced: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
