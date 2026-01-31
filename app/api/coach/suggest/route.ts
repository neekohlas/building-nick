import { NextResponse } from 'next/server'

export interface CoachSuggestion {
  activityId: string
  activityName: string
  reasoning: string
  timeBlock?: string
}

export interface CoachResponse {
  success: boolean
  message?: string
  suggestions?: CoachSuggestion[]
  followUpQuestion?: string
  error?: string
}

interface ActivityPattern {
  activityId: string
  activityName: string
  category: string
  completionCount: number
  lastCompleted?: string
}

interface RequestBody {
  mode?: 'continue_similar' | 'personalized' | 'refresh'
  recentPatterns: ActivityPattern[]
  availableActivities: Array<{
    id: string
    name: string
    category: string
    description?: string
    duration?: number
    favorite?: boolean
  }>
  userFeeling?: string
  excludeSuggestions?: string[] // Activity IDs to exclude when refreshing
}

// System prompt for "continue similar" mode
const CONTINUE_SIMILAR_PROMPT = `You are a supportive health coach helping someone plan their week's mind-body activities.

The user has been doing certain activities recently and wants to continue with similar ones.

Your job:
1. Acknowledge their consistency positively
2. Suggest 2-3 activities that build on their recent patterns
3. Include some they've done before (for continuity) and maybe one new one to try

Guidelines:
- Be warm and encouraging
- Keep the message brief (2-3 sentences)
- Focus on activities they've had success with
- PRIORITIZE activities marked as [FAVORITE] - always include at least one favorite if available
- Maybe suggest trying one new activity that complements their routine

IMPORTANT: You must respond with ONLY valid JSON. No other text.

Response format:
{
  "message": "Your encouraging response (2-3 sentences max)",
  "suggestions": [
    {
      "activityId": "exact_id_from_list",
      "activityName": "Activity Name",
      "reasoning": "Why this fits their pattern (1 sentence)"
    }
  ]
}`

// System prompt for "refresh" mode - different suggestions
const REFRESH_PROMPT = `You are a supportive health coach helping someone plan their week's mind-body activities.

The user didn't like the previous suggestions and wants to see different options.

Your job:
1. Acknowledge their desire to explore other activities
2. Suggest 2-3 DIFFERENT activities from the ones they already saw
3. Focus on variety - pick activities that serve different purposes

Guidelines:
- Be warm and understanding
- Keep the message brief (2-3 sentences)
- AVOID suggesting the activities marked as "PREVIOUSLY SUGGESTED"
- PRIORITIZE activities marked as [FAVORITE] that weren't already suggested
- Offer a diverse selection (e.g., one active, one calming, one quick)

IMPORTANT: You must respond with ONLY valid JSON. No other text.

Response format:
{
  "message": "Your encouraging response offering alternatives (2-3 sentences max)",
  "suggestions": [
    {
      "activityId": "exact_id_from_list",
      "activityName": "Activity Name",
      "reasoning": "Why this is a good alternative (1 sentence)"
    }
  ]
}`

// System prompt for "personalized" mode based on feelings
const PERSONALIZED_PROMPT = `You are a supportive health coach helping someone plan their week's mind-body activities based on how they're feeling.

Match activities to feelings:
- Energized/Motivated: Suggest more active practices like yoga, stretching, or longer meditation sessions
- Tired: Suggest gentle, restorative activities like breathing exercises, short meditations, or relaxation
- Stressed/Overwhelmed: Suggest calming activities like breathing, gentle meditation, grounding exercises
- Calm/Peaceful: This is a good state - suggest activities to maintain it, like regular meditation practice
- Unfocused/Scattered: Suggest focus-building activities like mindfulness meditation, breathing exercises

Guidelines:
- Be warm and understanding about how they feel
- Keep the message brief (2-3 sentences)
- Suggest 2-3 activities that specifically address their current state
- PRIORITIZE activities marked as [FAVORITE] - if a favorite matches their feeling, always include it
- Explain briefly why each activity helps with how they're feeling

IMPORTANT: You must respond with ONLY valid JSON. No other text.

Response format:
{
  "message": "Your supportive response acknowledging their feeling (2-3 sentences max)",
  "suggestions": [
    {
      "activityId": "exact_id_from_list",
      "activityName": "Activity Name",
      "reasoning": "Why this helps with how they're feeling (1 sentence)"
    }
  ]
}`

export async function POST(request: Request): Promise<NextResponse<CoachResponse>> {
  // Use HEALTH_COACH_API_KEY to avoid conflict with Claude Code's ANTHROPIC_API_KEY
  const apiKey = process.env.HEALTH_COACH_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Health Coach not configured'
    })
  }

  try {
    const body: RequestBody = await request.json()
    const { mode = 'personalized', recentPatterns, availableActivities, userFeeling, excludeSuggestions = [] } = body

    // Build available activities list with descriptions
    // Sort favorites first
    const sortedActivities = [...availableActivities].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1
      if (!a.favorite && b.favorite) return 1
      return 0
    })

    // Mark excluded activities
    const excludeSet = new Set(excludeSuggestions)
    const activitiesList = sortedActivities
      .map(a => {
        let entry = ''
        if (excludeSet.has(a.id)) {
          entry = `- [PREVIOUSLY SUGGESTED - AVOID] ID: "${a.id}" | Name: "${a.name}"`
        } else if (a.favorite) {
          entry = `- [FAVORITE] ID: "${a.id}" | Name: "${a.name}"`
        } else {
          entry = `- ID: "${a.id}" | Name: "${a.name}"`
        }
        if (a.duration) entry += ` | Duration: ${a.duration} min`
        if (a.description) entry += ` | Description: ${a.description}`
        return entry
      })
      .join('\n')

    let systemPrompt: string
    let userMessage: string

    if (mode === 'refresh') {
      systemPrompt = REFRESH_PROMPT

      // Include recent patterns as context
      let patternContext = ''
      if (recentPatterns.length > 0) {
        const patternLines = recentPatterns
          .slice(0, 3)
          .map(p => `${p.activityName} (${p.completionCount}x)`)
          .join(', ')
        patternContext = `\n\nFor context, they've recently done: ${patternLines}`
      }

      userMessage = `The user wants to see different activity suggestions.${patternContext}

Available mind-body activities (AVOID the ones marked "PREVIOUSLY SUGGESTED"):
${activitiesList}

Suggest 2-3 DIFFERENT activities from the ones they already saw. Use the exact "ID" values from the list above for activityId.`

    } else if (mode === 'continue_similar') {
      systemPrompt = CONTINUE_SIMILAR_PROMPT

      // Build pattern summary for continue similar mode
      const patternLines = recentPatterns
        .slice(0, 5)
        .map(p => `- ${p.activityName}: completed ${p.completionCount} times`)
        .join('\n')

      userMessage = `Here are the user's recent mind-body activities (past 4 weeks):
${patternLines || 'No recent activity data.'}

Available mind-body activities to suggest from:
${activitiesList}

Suggest 2-3 activities that continue their momentum. Use the exact "ID" values from the list above for activityId.`

    } else {
      // Personalized mode
      systemPrompt = PERSONALIZED_PROMPT

      // Include recent patterns as context
      let patternContext = ''
      if (recentPatterns.length > 0) {
        const patternLines = recentPatterns
          .slice(0, 3)
          .map(p => `${p.activityName} (${p.completionCount}x)`)
          .join(', ')
        patternContext = `\n\nFor context, they've recently done: ${patternLines}`
      }

      userMessage = `The user says they're feeling: "${userFeeling}"${patternContext}

Available mind-body activities to suggest from:
${activitiesList}

Based on how they're feeling, suggest 2-3 activities that would help. Use the exact "ID" values from the list above for activityId.`
    }

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', response.status, errorText)
      return NextResponse.json({
        success: false,
        error: `Health Coach API error: ${response.status} - ${errorText.substring(0, 100)}`
      })
    }

    const anthropicResponse = await response.json()

    // Extract text content from response
    const textContent = anthropicResponse.content?.find((block: { type: string }) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({
        success: false,
        error: 'No response from coach'
      })
    }

    // Parse the JSON response
    try {
      // Try to extract JSON from the response (it might have markdown code blocks)
      let jsonStr = textContent.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }

      const parsed = JSON.parse(jsonStr.trim())

      // Validate that suggestions have valid activity IDs
      const validActivityIds = new Set(availableActivities.map(a => a.id))
      const validSuggestions = (parsed.suggestions || []).filter(
        (s: CoachSuggestion) => validActivityIds.has(s.activityId)
      )

      return NextResponse.json({
        success: true,
        message: parsed.message,
        suggestions: validSuggestions,
        followUpQuestion: parsed.followUpQuestion
      })
    } catch {
      // If JSON parsing fails, return the raw message
      console.error('Failed to parse coach response:', textContent.text)
      return NextResponse.json({
        success: true,
        message: textContent.text,
        suggestions: []
      })
    }

  } catch (error) {
    console.error('Coach API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCause = error instanceof Error && error.cause ? String(error.cause) : ''
    return NextResponse.json({
      success: false,
      error: `${errorMessage}${errorCause ? ` (${errorCause})` : ''}`
    })
  }
}
