import { NextResponse } from 'next/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export type AudioCommand = 'next' | 'repeat' | 'back' | 'pause' | 'stop' | 'unknown'

interface CommandRequest {
  transcript: string
  currentStep: number
  totalSteps: number
}

export async function POST(request: Request) {
  try {
    const body: CommandRequest = await request.json()
    const { transcript, currentStep, totalSteps } = body

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json({
        command: 'unknown',
        confidence: 'low',
        interpretation: 'No speech detected'
      })
    }

    // If no API key, use fallback keyword matching
    if (!ANTHROPIC_API_KEY) {
      console.log('No Anthropic API key, using fallback keyword matching')
      return NextResponse.json({
        command: fallbackKeywordMatch(transcript),
        confidence: 'medium',
        interpretation: transcript
      })
    }

    const systemPrompt = `You interpret voice commands for a guided meditation/exercise app. The user is on step ${currentStep} of ${totalSteps}.

Your job is to understand what the user wants and respond with exactly ONE of these commands:
- "next" - user is ready to proceed (e.g., "okay", "ready", "continue", "next", "got it", "done", "I'm ready", "yes", "yep", "alright")
- "repeat" - user wants to hear the step again (e.g., "what?", "again", "repeat", "say that again", "I missed that", "huh", "sorry")
- "back" - user wants the previous step (e.g., "go back", "previous", "before that", "wait go back")
- "pause" - user needs a moment (e.g., "hold on", "wait", "pause", "give me a second", "one moment", "just a sec")
- "stop" - user wants to end the session (e.g., "stop", "quit", "exit", "I'm done", "end", "that's enough", "finish")
- "unknown" - unclear what user wants

Respond with ONLY a JSON object: {"command": "...", "confidence": "high/medium/low"}
No other text.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `User said: "${transcript}"`
          }
        ]
      })
    })

    if (!response.ok) {
      console.error('Anthropic API error:', response.status)
      // Fallback to keyword matching
      return NextResponse.json({
        command: fallbackKeywordMatch(transcript),
        confidence: 'low',
        interpretation: transcript
      })
    }

    const anthropicResponse = await response.json()
    const textContent = anthropicResponse.content?.find((block: { type: string }) => block.type === 'text')

    if (!textContent?.text) {
      return NextResponse.json({
        command: fallbackKeywordMatch(transcript),
        confidence: 'low',
        interpretation: transcript
      })
    }

    try {
      const parsed = JSON.parse(textContent.text)
      return NextResponse.json({
        command: parsed.command || 'unknown',
        confidence: parsed.confidence || 'medium',
        interpretation: transcript
      })
    } catch {
      // If parsing fails, try to extract command from text
      const text = textContent.text.toLowerCase()
      let command: AudioCommand = 'unknown'

      if (text.includes('next')) command = 'next'
      else if (text.includes('repeat')) command = 'repeat'
      else if (text.includes('back')) command = 'back'
      else if (text.includes('pause')) command = 'pause'
      else if (text.includes('stop')) command = 'stop'

      return NextResponse.json({
        command,
        confidence: 'low',
        interpretation: transcript
      })
    }
  } catch (error) {
    console.error('Audio command interpretation error:', error)

    // Fallback to keyword matching if Claude fails
    return NextResponse.json({
      command: 'unknown',
      confidence: 'low',
      interpretation: 'Error processing command'
    }, { status: 500 })
  }
}

// Fallback keyword matching when Claude is unavailable
function fallbackKeywordMatch(transcript: string): AudioCommand {
  const words = transcript.toLowerCase().split(' ')

  if (words.some((w) => ['next', 'continue', 'forward', 'okay', 'ready', 'done', 'got', 'yes', 'yep', 'alright'].includes(w))) {
    return 'next'
  } else if (words.some((w) => ['repeat', 'again', 'what', 'huh', 'sorry'].includes(w))) {
    return 'repeat'
  } else if (words.some((w) => ['back', 'previous', 'before'].includes(w))) {
    return 'back'
  } else if (words.some((w) => ['pause', 'wait', 'hold', 'moment', 'sec'].includes(w))) {
    return 'pause'
  } else if (words.some((w) => ['stop', 'exit', 'close', 'quit', 'end', 'finish', 'enough'].includes(w))) {
    return 'stop'
  }

  return 'unknown'
}
