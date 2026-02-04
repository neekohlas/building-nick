'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useStorage } from './use-storage'

export type ClaudeAudioPhase = 'idle' | 'generating' | 'speaking' | 'paused' | 'error'

export interface UseClaudeAudioState {
  phase: ClaudeAudioPhase
  error: string | null
  progress: number  // 0-100 for generation progress
  generatedScript: string | null  // The generated script text
  // Playback tracking
  currentTime: number  // Current playback position in seconds
  duration: number     // Total duration in seconds
}

interface UseClaudeAudioReturn extends UseClaudeAudioState {
  generateAndPlay: (activityId: string, lessonId: string, prompt: string) => Promise<void>
  playCached: (activityId: string, lessonId: string) => Promise<boolean>
  stop: () => void
  pause: () => void
  resume: () => void
  cancel: () => void  // Cancel generation in progress
  seek: (time: number) => void  // Seek to specific time
  regenerate: (activityId: string, lessonId: string, prompt: string) => Promise<void>
  hasCachedAudio: (activityId: string, lessonId: string) => Promise<boolean>
  isActive: boolean
}

/**
 * Hook for Claude-generated audio guides
 *
 * This handles:
 * 1. Generating a script using Claude based on an activity's custom prompt
 * 2. Converting the script to audio using TTS
 * 3. Caching the audio in IndexedDB
 * 4. Playing/pausing/stopping the audio
 * 5. Regenerating audio on demand
 */
export function useClaudeAudio(): UseClaudeAudioReturn {
  const storage = useStorage()
  const [state, setState] = useState<UseClaudeAudioState>({
    phase: 'idle',
    error: null,
    progress: 0,
    generatedScript: null,
    currentTime: 0,
    duration: 0,
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }
    }
  }, [])

  const playAudioBlob = useCallback((blob: Blob, onEnd?: () => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Clean up previous audio
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }

      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      // Set up duration when metadata loads
      audio.onloadedmetadata = () => {
        setState(prev => ({ ...prev, duration: audio.duration }))
      }

      audio.onended = () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current)
        }
        setState(prev => ({ ...prev, phase: 'idle', currentTime: 0 }))
        onEnd?.()
        resolve()
      }

      audio.onerror = (e) => {
        console.error('Audio playback error:', e)
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current)
        }
        setState(prev => ({ ...prev, phase: 'error', error: 'Audio playback failed' }))
        reject(new Error('Audio playback failed'))
      }

      audio.play()
        .then(() => {
          setState(prev => ({ ...prev, phase: 'speaking' }))
          // Update current time periodically
          timeUpdateIntervalRef.current = setInterval(() => {
            if (audioRef.current) {
              setState(prev => ({ ...prev, currentTime: audioRef.current?.currentTime || 0 }))
            }
          }, 250)
        })
        .catch(reject)
    })
  }, [])

  const hasCachedAudio = useCallback(async (activityId: string, lessonId: string): Promise<boolean> => {
    if (!storage.isReady) return false
    const cached = await storage.getClaudeGeneratedAudio(activityId, lessonId)
    return cached !== null
  }, [storage])

  const playCached = useCallback(async (activityId: string, lessonId: string): Promise<boolean> => {
    if (!storage.isReady) return false

    try {
      const cached = await storage.getClaudeGeneratedAudio(activityId, lessonId)
      if (!cached) return false

      await playAudioBlob(cached)
      return true
    } catch (error) {
      console.error('Error playing cached audio:', error)
      return false
    }
  }, [storage, playAudioBlob])

  const generateAndPlay = useCallback(async (
    activityId: string,
    lessonId: string,
    prompt: string
  ): Promise<void> => {
    // Check cache first
    if (storage.isReady) {
      const cached = await storage.getClaudeGeneratedAudio(activityId, lessonId)
      if (cached) {
        console.log('Playing cached Claude audio for:', activityId, lessonId)
        await playAudioBlob(cached)
        return
      }
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    setState({ phase: 'generating', error: null, progress: 10, generatedScript: null, currentTime: 0, duration: 0 })

    try {
      // Step 1: Generate script with Claude
      console.log('Generating script with Claude...')
      const scriptResponse = await fetch('/api/claude-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal,
      })

      if (signal.aborted) throw new Error('Cancelled')

      if (!scriptResponse.ok) {
        throw new Error('Failed to generate script')
      }

      const { script } = await scriptResponse.json()
      setState(prev => ({ ...prev, progress: 50, generatedScript: script }))

      if (signal.aborted) throw new Error('Cancelled')

      // Step 2: Convert script to audio with TTS
      console.log('Converting script to audio...')
      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice: 'rachel' }),
        signal,
      })

      if (signal.aborted) throw new Error('Cancelled')

      if (!ttsResponse.ok) {
        throw new Error('Failed to convert to audio')
      }

      const audioBlob = await ttsResponse.blob()
      setState(prev => ({ ...prev, progress: 90 }))

      // Step 3: Cache the audio
      if (storage.isReady) {
        await storage.saveClaudeGeneratedAudio(activityId, lessonId, script, audioBlob)
      }

      setState(prev => ({ ...prev, progress: 100 }))

      if (signal.aborted) throw new Error('Cancelled')

      // Step 4: Play the audio
      await playAudioBlob(audioBlob)

    } catch (error) {
      // Don't show error for user cancellation
      if (error instanceof Error && error.message === 'Cancelled') {
        setState({ phase: 'idle', error: null, progress: 0, generatedScript: null, currentTime: 0, duration: 0 })
        return
      }
      // Abort errors (from fetch) should also be silent
      if (error instanceof Error && error.name === 'AbortError') {
        setState({ phase: 'idle', error: null, progress: 0, generatedScript: null, currentTime: 0, duration: 0 })
        return
      }
      console.error('Claude audio generation error:', error)
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }, [storage, playAudioBlob])

  const regenerate = useCallback(async (
    activityId: string,
    lessonId: string,
    prompt: string
  ): Promise<void> => {
    // Delete existing cache first
    if (storage.isReady) {
      await storage.deleteClaudeGeneratedAudio(activityId, lessonId)
    }

    // Generate fresh audio
    await generateAndPlay(activityId, lessonId, prompt)
  }, [storage, generateAndPlay])

  const stop = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
      timeUpdateIntervalRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setState({ phase: 'idle', error: null, progress: 0, generatedScript: null, currentTime: 0, duration: 0 })
  }, [])

  const cancel = useCallback(() => {
    // Abort any in-progress fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // Also stop any audio
    stop()
  }, [stop])

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0))
      setState(prev => ({ ...prev, currentTime: audioRef.current?.currentTime || 0 }))
    }
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current && state.phase === 'speaking') {
      audioRef.current.pause()
      setState(prev => ({ ...prev, phase: 'paused' }))
    }
  }, [state.phase])

  const resume = useCallback(() => {
    if (audioRef.current && state.phase === 'paused') {
      audioRef.current.play()
      setState(prev => ({ ...prev, phase: 'speaking' }))
    }
  }, [state.phase])

  return {
    ...state,
    generateAndPlay,
    playCached,
    stop,
    pause,
    resume,
    cancel,
    seek,
    regenerate,
    hasCachedAudio,
    isActive: state.phase !== 'idle' && state.phase !== 'error',
  }
}
