'use client'

import { useEffect, useRef } from 'react'
import { X, Volume2, Mic, MicOff, SkipBack, SkipForward, RotateCcw, Pause, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAudioInstructions } from '@/hooks/use-audio-instructions'

interface AudioInstructionsOverlayProps {
  instructions: string
  activityName: string
  onClose: () => void
}

export function AudioInstructionsOverlay({
  instructions,
  activityName,
  onClose,
}: AudioInstructionsOverlayProps) {
  const {
    phase,
    currentStepIndex,
    steps,
    error,
    lastTranscript,
    isTTSSupported,
    isSTTSupported,
    startAudioMode,
    stopAudioMode,
    nextStep,
    previousStep,
    repeatStep,
    pause,
    resume,
    isActive,
  } = useAudioInstructions()

  const hasInitialized = useRef(false)

  // Start audio mode when overlay mounts
  useEffect(() => {
    if (!hasInitialized.current && isTTSSupported) {
      hasInitialized.current = true
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        startAudioMode(instructions)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [instructions, startAudioMode, isTTSSupported])

  // Cleanup on unmount - ensure audio stops
  useEffect(() => {
    return () => {
      stopAudioMode()
    }
  }, [stopAudioMode])

  // Handle close
  const handleClose = () => {
    stopAudioMode()
    onClose()
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        previousStep()
      } else if (e.key === 'r') {
        e.preventDefault()
        repeatStep()
      } else if (e.key === 'p') {
        e.preventDefault()
        if (phase === 'paused') {
          resume()
        } else {
          pause()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextStep, previousStep, repeatStep, pause, resume, phase])

  const progressPercent = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0

  if (!isTTSSupported) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
        <div className="max-w-md text-center text-white">
          <h2 className="text-xl font-semibold mb-4">Audio Mode Not Supported</h2>
          <p className="text-white/70 mb-6">
            Your browser doesn&apos;t support text-to-speech. Please try using Chrome or Safari.
          </p>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-primary" />
          <span className="text-white font-medium">{activityName}</span>
        </div>
        <button
          onClick={handleClose}
          className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {error ? (
          <div className="text-red-400 mb-4">{error}</div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="text-white/50 text-sm mb-4">
              Step {currentStepIndex + 1} of {steps.length}
            </div>

            {/* Current step text */}
            <div className="max-w-xl text-2xl md:text-3xl font-medium text-white leading-relaxed mb-8">
              {steps[currentStepIndex] || 'Loading...'}
            </div>

            {/* Phase indicator */}
            <div className="flex items-center gap-3 mb-8">
              {phase === 'speaking' && (
                <>
                  <Volume2 className="h-6 w-6 text-primary animate-pulse" />
                  <span className="text-white/70">Speaking...</span>
                </>
              )}
              {phase === 'listening' && (
                <>
                  <Mic className="h-6 w-6 text-green-400 animate-pulse" />
                  <span className="text-white/70">Listening... (say anything naturally)</span>
                </>
              )}
              {phase === 'processing' && (
                <>
                  <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                  <span className="text-white/70">Understanding...</span>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <MicOff className="h-6 w-6 text-yellow-400" />
                  <span className="text-white/70">Paused - tap Resume or speak</span>
                </>
              )}
            </div>

            {/* Last recognized command */}
            {lastTranscript && (
              <div className="text-white/40 text-sm mb-4">
                Heard: &quot;{lastTranscript}&quot;
              </div>
            )}

            {/* Voice commands hint */}
            {isSTTSupported && (
              <div className="text-white/30 text-xs mb-6">
                Speak naturally: &quot;I&apos;m ready&quot;, &quot;say that again&quot;, &quot;go back&quot;, &quot;hold on&quot;, &quot;I&apos;m done&quot;
              </div>
            )}
          </>
        )}
      </div>

      {/* Main navigation controls - large touch targets */}
      <div className="border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Primary: Back / Repeat / Next - large buttons */}
        <div className="max-w-md mx-auto flex items-center justify-center gap-3 mb-3">
          <button
            onClick={previousStep}
            disabled={currentStepIndex === 0 || !isActive}
            className="flex-1 flex items-center justify-center gap-2 h-14 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <SkipBack className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <button
            onClick={repeatStep}
            disabled={!isActive}
            className="flex items-center justify-center gap-2 h-14 w-14 rounded-xl border border-white/20 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          <button
            onClick={nextStep}
            disabled={currentStepIndex >= steps.length - 1 || !isActive}
            className="flex-1 flex items-center justify-center gap-2 h-14 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:opacity-30 disabled:pointer-events-none transition-all font-medium"
          >
            <span className="text-sm font-medium">Next</span>
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Secondary: Pause/Resume */}
        <div className="max-w-md mx-auto flex justify-center">
          {phase === 'paused' ? (
            <button
              onClick={resume}
              className="flex items-center justify-center gap-2 h-10 px-6 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          ) : (
            <button
              onClick={pause}
              disabled={!isActive}
              className="flex items-center justify-center gap-2 h-10 px-6 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all text-sm"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
