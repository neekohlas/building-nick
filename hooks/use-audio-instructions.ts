'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useStorage } from './use-storage'

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
  const storage = useStorage()
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
  const storageRef = useRef(storage) // Keep storage ref current
  const isStoppedRef = useRef(false) // Track if audio mode has been stopped to prevent callbacks
  const keepAliveTimerRef = useRef<NodeJS.Timeout | null>(null) // Periodic restart for iOS Safari
  const lastInterimRef = useRef<string>('') // Track interim results for quick keyword matching

  // Keep storageRef in sync
  useEffect(() => {
    storageRef.current = storage
  }, [storage])

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
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current)
        keepAliveTimerRef.current = null
      }
    }
  }, [])

  // Browser TTS fallback
  const speakWithBrowser = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || isStoppedRef.current) {
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
      // Only call onEnd if not stopped
      if (!isStoppedRef.current) {
        onEnd?.()
      }
    }

    utterance.onerror = () => {
      utteranceRef.current = null
      if (!isStoppedRef.current) {
        setState((prev) => ({ ...prev, error: 'Speech synthesis error' }))
      }
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  // OpenAI TTS with IndexedDB caching
  const speakWithOpenAI = useCallback(async (text: string, onEnd?: () => void) => {
    // Don't start if already stopped
    if (isStoppedRef.current) return

    const voice = 'rachel'

    try {
      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Check if stopped during cleanup
      if (isStoppedRef.current) return

      // Check cache first
      let audioBlob: Blob | null = null
      if (storageRef.current.isReady) {
        audioBlob = await storageRef.current.getCachedAudio(text, voice)
      }

      // Check if stopped during cache lookup
      if (isStoppedRef.current) return

      // If not cached, fetch from API
      if (!audioBlob) {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice }),
        })

        // Check if stopped during fetch
        if (isStoppedRef.current) return

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

        audioBlob = await response.blob()

        // Cache the audio for future use
        if (storageRef.current.isReady) {
          storageRef.current.saveAudioToCache(text, voice, audioBlob).catch(err => {
            console.warn('Failed to cache audio:', err)
          })
        }
      }

      // Check if stopped before playing
      if (isStoppedRef.current) return

      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        // Only call onEnd if not stopped
        if (!isStoppedRef.current) {
          onEnd?.()
        }
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
        // Only fall back if not stopped
        if (!isStoppedRef.current) {
          console.log('Audio playback error, using browser TTS')
          speakWithBrowser(text, onEnd)
        }
      }

      await audio.play()
    } catch (error) {
      console.error('OpenAI TTS error:', error)
      // Only fall back if not stopped
      if (!isStoppedRef.current) {
        useOpenAITTS.current = false
        speakWithBrowser(text, onEnd)
      }
    }
  }, [speakWithBrowser])

  // Main speak function - tries OpenAI first, falls back to browser
  const speak = useCallback((text: string, onEnd?: () => void) => {
    // Don't speak if stopped
    if (isStoppedRef.current) return

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

  // Quick keyword check for interim results - skips Claude API for obvious commands
  const quickKeywordCheck = useCallback((transcript: string): AudioCommand | null => {
    const words = transcript.toLowerCase().trim().split(/\s+/)
    // Only match very clear, unambiguous single-word commands from interim results
    const nextWords = ['next', 'continue', 'forward', 'okay', 'ok', 'ready', 'done', 'yes', 'yep', 'alright']
    const repeatWords = ['repeat', 'again']
    const backWords = ['back', 'previous']
    const stopWords = ['stop', 'quit', 'exit', 'end']
    const pauseWords = ['pause', 'wait', 'hold']

    if (words.some(w => nextWords.includes(w))) return 'next'
    if (words.some(w => repeatWords.includes(w))) return 'repeat'
    if (words.some(w => backWords.includes(w))) return 'back'
    if (words.some(w => stopWords.includes(w))) return 'stop'
    if (words.some(w => pauseWords.includes(w))) return 'pause'
    return null
  }, [])

  const startListening = useCallback(() => {
    // Don't start listening if stopped
    if (isStoppedRef.current) return
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // STT not supported, stay in paused state waiting for manual input
      setState((prev) => ({ ...prev, phase: 'paused' }))
      return
    }

    // Stop any existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore abort errors
      }
    }

    // Clear any existing keep-alive timer
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current)
      keepAliveTimerRef.current = null
    }

    try {
      const recognition = new SpeechRecognition()
      // Keep listening continuously so user doesn't have to rush
      recognition.continuous = true
      // Enable interim results so we can detect short words faster
      recognition.interimResults = true
      recognition.lang = 'en-US'

      let hasProcessedCommand = false

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Don't process if stopped or already processing a command from this session
        if (isStoppedRef.current || hasProcessedCommand) return

        // Get the most recent result
        const lastResultIndex = event.results.length - 1
        const result = event.results[lastResultIndex]
        const transcript = result[0].transcript.toLowerCase().trim()

        if (result.isFinal) {
          // Final result - process through full pipeline
          hasProcessedCommand = true
          setState((prev) => ({ ...prev, lastTranscript: transcript }))
          lastInterimRef.current = ''

          // Stop recognition while we process and speak
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop()
            } catch {
              // Ignore stop errors
            }
          }
          handleCommand(transcript)
        } else {
          // Interim result - check for obvious keyword commands for faster response
          lastInterimRef.current = transcript
          setState((prev) => ({ ...prev, lastTranscript: `${transcript}...` }))

          const quickCommand = quickKeywordCheck(transcript)
          if (quickCommand) {
            hasProcessedCommand = true
            setState((prev) => ({ ...prev, lastTranscript: transcript }))
            lastInterimRef.current = ''

            // Stop recognition and execute immediately (skip Claude API)
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop()
              } catch {
                // Ignore stop errors
              }
            }
            setState((prev) => ({ ...prev, phase: 'processing' }))
            executeCommand(quickCommand)
          }
        }
      }

      recognition.onerror = (event) => {
        // Don't handle errors if stopped
        if (isStoppedRef.current) return

        // "no-speech" is expected when user is quiet - restart listening
        const errorEvent = event as unknown as { error?: string }
        if (errorEvent.error === 'no-speech' || errorEvent.error === 'aborted') {
          // Restart listening after a brief pause
          setTimeout(() => {
            if (!isStoppedRef.current && stateRef.current.phase === 'listening') {
              startListening()
            }
          }, 200)
          return
        }
        // On other errors, fall back to paused state (user can use manual controls)
        console.log('Speech recognition error:', errorEvent.error)
        setState((prev) => ({ ...prev, phase: 'paused' }))
      }

      recognition.onend = () => {
        // Don't restart if stopped
        if (isStoppedRef.current) return

        // If we're still supposed to be listening, restart
        // This handles browser timeouts (usually ~60 seconds)
        if (stateRef.current.phase === 'listening') {
          setTimeout(() => {
            if (!isStoppedRef.current && stateRef.current.phase === 'listening') {
              startListening()
            }
          }, 100)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setState((prev) => ({ ...prev, phase: 'listening' }))

      // iOS Safari keep-alive: periodically restart recognition to prevent silent death
      keepAliveTimerRef.current = setInterval(() => {
        if (isStoppedRef.current || stateRef.current.phase !== 'listening') {
          if (keepAliveTimerRef.current) {
            clearInterval(keepAliveTimerRef.current)
            keepAliveTimerRef.current = null
          }
          return
        }
        // Restart recognition to prevent iOS Safari from silently stopping
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop()
          } catch {
            // Will be restarted by onend handler
          }
        }
      }, 45000) // Restart every 45 seconds (before the ~60s browser timeout)
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

    // Reset stopped flag when starting
    isStoppedRef.current = false

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
    // Set stopped flag FIRST to prevent any callbacks from firing
    isStoppedRef.current = true

    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current)
      keepAliveTimerRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = '' // Clear the source to fully stop
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
