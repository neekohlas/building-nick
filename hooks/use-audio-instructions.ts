'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// Types for speech recognition (not fully typed in lib.dom.d.ts)
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInterface
    webkitSpeechRecognition?: new () => SpeechRecognitionInterface
  }
}

export type AudioPhase = 'idle' | 'speaking' | 'listening' | 'processing' | 'paused'
export type AudioCommand = 'next' | 'repeat' | 'back' | 'pause' | 'stop' | 'unknown'

export interface AudioInstructionsState {
  phase: AudioPhase
  currentStepIndex: number
  steps: string[]
  closingContext: string | null
  error: string | null
  lastTranscript: string | null
  isTTSSupported: boolean
  isSTTSupported: boolean
}

interface UseAudioInstructionsReturn extends AudioInstructionsState {
  startAudioMode: (instructionsHtml: string) => void
  stopAudioMode: () => void
  nextStep: () => void
  previousStep: () => void
  repeatStep: () => void
  pause: () => void
  resume: () => void
  isActive: boolean
}

/**
 * Parse HTML instructions into an array of step strings
 * Expects format: <h4>Instructions</h4><ol><li>Step 1</li>...</ol><p>Context</p>
 */
export function parseInstructions(html: string): { steps: string[]; closingContext: string | null } {
  if (typeof document === 'undefined') {
    return { steps: [], closingContext: null }
  }

  const div = document.createElement('div')
  div.innerHTML = html

  // Extract all list items as steps
  const listItems = div.querySelectorAll('li')
  const steps: string[] = []
  listItems.forEach((li) => {
    const text = li.textContent?.trim()
    if (text) {
      steps.push(text)
    }
  })

  // Extract closing paragraph(s) as context
  const paragraphs = div.querySelectorAll('p')
  let closingContext: string | null = null
  if (paragraphs.length > 0) {
    const contextParts: string[] = []
    paragraphs.forEach((p) => {
      const text = p.textContent?.trim()
      if (text) {
        contextParts.push(text)
      }
    })
    if (contextParts.length > 0) {
      closingContext = contextParts.join(' ')
    }
  }

  return { steps, closingContext }
}

/**
 * Check if instructions have multiple steps (worth using audio mode)
 */
export function hasMultipleSteps(html: string): boolean {
  if (typeof document === 'undefined') {
    return false
  }
  const { steps } = parseInstructions(html)
  return steps.length >= 2
}

export function useAudioInstructions(): UseAudioInstructionsReturn {
  const [state, setState] = useState<AudioInstructionsState>({
    phase: 'idle',
    currentStepIndex: 0,
    steps: [],
    closingContext: null,
    error: null,
    lastTranscript: null,
    isTTSSupported: false,
    isSTTSupported: false,
  })

  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stateRef = useRef(state)
  const useOpenAITTS = useRef(true) // Try OpenAI first, fall back to browser if unavailable

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Check browser support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isTTSSupported = 'speechSynthesis' in window
    const isSTTSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window

    setState((prev) => ({
      ...prev,
      isTTSSupported,
      isSTTSupported,
    }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Browser TTS fallback
  const speakWithBrowser = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.()
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9 // Slightly slower for clarity
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onend = () => {
      utteranceRef.current = null
      onEnd?.()
    }

    utterance.onerror = () => {
      utteranceRef.current = null
      setState((prev) => ({ ...prev, error: 'Speech synthesis error' }))
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  // OpenAI TTS with caching
  const speakWithOpenAI = useCallback(async (text: string, onEnd?: () => void) => {
    try {
      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'rachel' }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (data.fallback) {
          // OpenAI not available, fall back to browser TTS
          console.log('OpenAI TTS unavailable, using browser TTS')
          useOpenAITTS.current = false
          speakWithBrowser(text, onEnd)
          return
        }
        throw new Error('TTS failed')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        onEnd?.()
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        // Fall back to browser TTS
        console.log('Audio playback error, using browser TTS')
        speakWithBrowser(text, onEnd)
      }

      await audio.play()
    } catch (error) {
      console.error('OpenAI TTS error:', error)
      // Fall back to browser TTS
      useOpenAITTS.current = false
      speakWithBrowser(text, onEnd)
    }
  }, [speakWithBrowser])

  // Main speak function - tries OpenAI first, falls back to browser
  const speak = useCallback((text: string, onEnd?: () => void) => {
    // Cancel any ongoing browser speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    if (useOpenAITTS.current) {
      speakWithOpenAI(text, onEnd)
    } else {
      speakWithBrowser(text, onEnd)
    }
  }, [speakWithOpenAI, speakWithBrowser])

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // STT not supported, stay in paused state waiting for manual input
      setState((prev) => ({ ...prev, phase: 'paused' }))
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim()
        setState((prev) => ({ ...prev, lastTranscript: transcript }))
        handleCommand(transcript)
      }

      recognition.onerror = () => {
        // On error, fall back to paused state (user can use manual controls)
        setState((prev) => ({ ...prev, phase: 'paused' }))
      }

      recognition.onend = () => {
        // If we're still in listening phase, restart (in case it times out)
        if (stateRef.current.phase === 'listening') {
          setState((prev) => ({ ...prev, phase: 'paused' }))
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setState((prev) => ({ ...prev, phase: 'listening' }))
    } catch {
      setState((prev) => ({ ...prev, phase: 'paused' }))
    }
  }, [])

  // Execute a command (used by both Claude interpretation and manual buttons)
  const executeCommand = useCallback((command: AudioCommand) => {
    const current = stateRef.current

    switch (command) {
      case 'next':
        if (current.currentStepIndex < current.steps.length - 1) {
          const newIndex = current.currentStepIndex + 1
          setState((prev) => ({ ...prev, currentStepIndex: newIndex, phase: 'speaking' }))
          speak(current.steps[newIndex], startListening)
        } else if (current.closingContext) {
          setState((prev) => ({ ...prev, phase: 'speaking' }))
          speak(current.closingContext, () => {
            setState((prev) => ({ ...prev, phase: 'idle' }))
          })
        } else {
          setState((prev) => ({ ...prev, phase: 'idle' }))
        }
        break

      case 'repeat':
        setState((prev) => ({ ...prev, phase: 'speaking' }))
        speak(current.steps[current.currentStepIndex], startListening)
        break

      case 'back':
        if (current.currentStepIndex > 0) {
          const newIndex = current.currentStepIndex - 1
          setState((prev) => ({ ...prev, currentStepIndex: newIndex, phase: 'speaking' }))
          speak(current.steps[newIndex], startListening)
        } else {
          setState((prev) => ({ ...prev, phase: 'speaking' }))
          speak(current.steps[0], startListening)
        }
        break

      case 'pause':
        if (recognitionRef.current) {
          recognitionRef.current.abort()
        }
        setState((prev) => ({ ...prev, phase: 'paused' }))
        break

      case 'stop':
        if (recognitionRef.current) {
          recognitionRef.current.abort()
        }
        window.speechSynthesis?.cancel()
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        setState((prev) => ({
          ...prev,
          phase: 'idle',
          currentStepIndex: 0,
          steps: [],
          closingContext: null,
        }))
        break

      case 'unknown':
      default:
        // Unrecognized, go back to listening
        startListening()
        break
    }
  }, [speak, startListening])

  // Interpret command using Claude API
  const interpretWithClaude = useCallback(async (transcript: string): Promise<AudioCommand> => {
    const current = stateRef.current

    try {
      const response = await fetch('/api/audio-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          currentStep: current.currentStepIndex + 1,
          totalSteps: current.steps.length,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to interpret command')
      }

      const data = await response.json()
      return data.command as AudioCommand
    } catch (error) {
      console.error('Claude interpretation error:', error)
      // Fallback to simple keyword matching
      return fallbackKeywordMatch(transcript)
    }
  }, [])

  // Fallback keyword matching (used if Claude fails)
  const fallbackKeywordMatch = (transcript: string): AudioCommand => {
    const words = transcript.toLowerCase().split(' ')

    if (words.some((w) => ['next', 'continue', 'forward', 'okay', 'ready', 'done', 'got'].includes(w))) {
      return 'next'
    } else if (words.some((w) => ['repeat', 'again', 'what'].includes(w))) {
      return 'repeat'
    } else if (words.some((w) => ['back', 'previous', 'before'].includes(w))) {
      return 'back'
    } else if (words.some((w) => ['pause', 'wait', 'hold', 'moment'].includes(w))) {
      return 'pause'
    } else if (words.some((w) => ['stop', 'exit', 'close', 'quit', 'end'].includes(w))) {
      return 'stop'
    }

    return 'unknown'
  }

  const handleCommand = useCallback(async (transcript: string) => {
    // Show processing state while Claude interprets
    setState((prev) => ({ ...prev, phase: 'processing' }))

    // Use Claude to interpret the command
    const command = await interpretWithClaude(transcript)

    // Execute the interpreted command
    executeCommand(command)
  }, [interpretWithClaude, executeCommand])

  const startAudioMode = useCallback((instructionsHtml: string) => {
    const { steps, closingContext } = parseInstructions(instructionsHtml)

    if (steps.length === 0) {
      setState((prev) => ({ ...prev, error: 'No instructions found' }))
      return
    }

    setState((prev) => ({
      ...prev,
      phase: 'speaking',
      currentStepIndex: 0,
      steps,
      closingContext,
      error: null,
      lastTranscript: null,
    }))

    // Start with a brief intro then first step
    speak(`Step 1 of ${steps.length}. ${steps[0]}`, startListening)
  }, [speak, startListening])

  const stopAudioMode = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setState((prev) => ({
      ...prev,
      phase: 'idle',
      currentStepIndex: 0,
      steps: [],
      closingContext: null,
      lastTranscript: null,
    }))
  }, [])

  const nextStep = useCallback(() => {
    const current = stateRef.current
    if (current.currentStepIndex < current.steps.length - 1) {
      const newIndex = current.currentStepIndex + 1
      setState((prev) => ({ ...prev, currentStepIndex: newIndex, phase: 'speaking' }))
      speak(`Step ${newIndex + 1} of ${current.steps.length}. ${current.steps[newIndex]}`, startListening)
    } else if (current.closingContext) {
      setState((prev) => ({ ...prev, phase: 'speaking' }))
      speak(current.closingContext, () => {
        setState((prev) => ({ ...prev, phase: 'idle' }))
      })
    } else {
      setState((prev) => ({ ...prev, phase: 'idle' }))
    }
  }, [speak, startListening])

  const previousStep = useCallback(() => {
    const current = stateRef.current
    if (current.currentStepIndex > 0) {
      const newIndex = current.currentStepIndex - 1
      setState((prev) => ({ ...prev, currentStepIndex: newIndex, phase: 'speaking' }))
      speak(`Step ${newIndex + 1} of ${current.steps.length}. ${current.steps[newIndex]}`, startListening)
    }
  }, [speak, startListening])

  const repeatStep = useCallback(() => {
    const current = stateRef.current
    setState((prev) => ({ ...prev, phase: 'speaking' }))
    speak(`Step ${current.currentStepIndex + 1} of ${current.steps.length}. ${current.steps[current.currentStepIndex]}`, startListening)
  }, [speak, startListening])

  const pause = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setState((prev) => ({ ...prev, phase: 'paused' }))
  }, [])

  const resume = useCallback(() => {
    const current = stateRef.current
    setState((prev) => ({ ...prev, phase: 'speaking' }))
    speak(current.steps[current.currentStepIndex], startListening)
  }, [speak, startListening])

  return {
    ...state,
    startAudioMode,
    stopAudioMode,
    nextStep,
    previousStep,
    repeatStep,
    pause,
    resume,
    isActive: state.phase !== 'idle',
  }
}
