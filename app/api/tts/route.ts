import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// ElevenLabs voice IDs - these are pre-made voices
// Rachel is a calm, warm female voice good for meditation/guidance
const ELEVENLABS_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // Calm, warm female
  drew: '29vD33N1CtxCmqQRPOHJ',   // Calm male
  clyde: '2EiwWnXFnvU5JabPnv8n',  // Deep male
  domi: 'AZnzlk1XvdvUeBnXmlld',   // Young female
  bella: 'EXAVITQu4vr4xnSDxMaL',  // Soft female
  antoni: 'ErXwobaYiN019PkySvjV', // Warm male
  sarah: 'EXAVITQu4vr4xnSDxMaL',  // Default premade
}

// Cache directory for audio files
const CACHE_DIR = join(process.cwd(), '.audio-cache')

// Generate a hash for the text to use as filename
function getAudioHash(text: string, voice: string): string {
  return createHash('md5').update(`elevenlabs:${voice}:${text}`).digest('hex')
}

// Ensure cache directory exists
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }
}

export async function POST(request: Request) {
  try {
    const { text, voice = 'rachel' } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    // Check if we have a cached version
    ensureCacheDir()
    const hash = getAudioHash(text, voice)
    const cachePath = join(CACHE_DIR, `${hash}.mp3`)

    if (existsSync(cachePath)) {
      // Return cached audio
      console.log('TTS cache hit:', hash)
      const audioData = readFileSync(cachePath)
      return new NextResponse(audioData, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Cache': 'HIT',
        },
      })
    }

    // No cache - generate with ElevenLabs
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured', fallback: true },
        { status: 503 }
      )
    }

    console.log('TTS cache miss, generating:', hash)

    const voiceId = ELEVENLABS_VOICES[voice as keyof typeof ELEVENLABS_VOICES] || ELEVENLABS_VOICES.rachel

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs TTS error:', response.status, errorText)
      return NextResponse.json(
        { error: 'TTS generation failed', fallback: true },
        { status: 502 }
      )
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer()
    const audioData = Buffer.from(audioBuffer)

    // Cache it for future use
    try {
      writeFileSync(cachePath, audioData)
      console.log('TTS cached:', hash)
    } catch (cacheError) {
      console.error('Failed to cache TTS:', cacheError)
      // Continue anyway - just won't be cached
    }

    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: 'TTS request failed', fallback: true },
      { status: 500 }
    )
  }
}

// GET endpoint to check if audio is cached (for preloading)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get('text')
  const voice = searchParams.get('voice') || 'rachel'

  if (!text) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  ensureCacheDir()
  const hash = getAudioHash(text, voice)
  const cachePath = join(CACHE_DIR, `${hash}.mp3`)
  const cached = existsSync(cachePath)

  return NextResponse.json({ cached, hash })
}
