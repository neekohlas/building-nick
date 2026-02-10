'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Play, Volume2, RefreshCw, Loader2, X, Pause, BookOpen } from 'lucide-react'
import { Lesson } from '@/lib/activities'
import { useClaudeAudio } from '@/hooks/use-claude-audio'
import { Button } from '@/components/ui/button'
import { AudioInstructionsOverlay } from '@/components/audio-instructions-overlay'

// Extract Vimeo video ID and hash from URL
function getVimeoEmbedUrl(url: string): string | null {
  // Match vimeo.com/VIDEO_ID or vimeo.com/VIDEO_ID/HASH
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/)
  if (!match) return null

  const videoId = match[1]
  const hash = match[2]

  // For unlisted videos, include the hash parameter
  if (hash) {
    return `https://player.vimeo.com/video/${videoId}?h=${hash}&autoplay=1`
  }
  return `https://player.vimeo.com/video/${videoId}?autoplay=1`
}

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Extract Vimeo video ID from URL
function getVimeoVideoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

// Check if URL is a Vimeo video
function isVimeoUrl(url: string): boolean {
  return /vimeo\.com\/\d+/.test(url)
}

// Hook to fetch Vimeo thumbnail via oEmbed API
function useVimeoThumbnail(url: string | undefined) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    const videoId = getVimeoVideoId(url)
    if (!videoId) return

    // For unlisted videos, pass the full URL (with privacy hash) to oEmbed
    // e.g. vimeo.com/715226740/a262662ffb — the hash is required for the API to respond
    const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/)
    const oEmbedUrl = match && match[2]
      ? `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${match[1]}/${match[2]}`
      : `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`

    fetch(oEmbedUrl)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.thumbnail_url) {
          // Request a larger thumbnail (640px wide)
          setThumbnail(data.thumbnail_url.replace(/\d+x\d+/, '640x360'))
        }
      })
      .catch(() => {})
  }, [url])

  return thumbnail
}

interface LessonCardProps {
  lesson: Lesson
  activityId: string
  claudePrompt?: string
  isActive: boolean
}

function LessonCard({ lesson, activityId, claudePrompt, isActive }: LessonCardProps) {
  const claudeAudio = useClaudeAudio()
  const [hasCached, setHasCached] = useState(false)

  // Check if Claude audio is cached
  useEffect(() => {
    if (lesson.type === 'claude_audio') {
      claudeAudio.hasCachedAudio(activityId, lesson.id).then(setHasCached)
    }
  }, [lesson.type, lesson.id, activityId, claudeAudio])

  const handleClaudeAudioPlay = async () => {
    if (!claudePrompt) return

    if (hasCached) {
      await claudeAudio.playCached(activityId, lesson.id)
    } else {
      await claudeAudio.generateAndPlay(activityId, lesson.id, claudePrompt)
      setHasCached(true)
    }
  }

  const handleRegenerate = async () => {
    if (!claudePrompt) return
    await claudeAudio.regenerate(activityId, lesson.id, claudePrompt)
  }

  // YouTube lesson - plays in-app with embedded player
  if (lesson.type === 'youtube' && lesson.url) {
    const [isPlaying, setIsPlaying] = useState(false)
    const videoId = getYouTubeVideoId(lesson.url)
    if (!videoId) return null

    if (isPlaying) {
      return (
        <div className="w-full">
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setIsPlaying(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white z-10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-medium mt-2 text-center">{lesson.title}</p>
        </div>
      )
    }

    return (
      <div className="w-full">
        <button
          onClick={() => setIsPlaying(true)}
          className="relative w-full aspect-video rounded-lg overflow-hidden bg-black block group"
        >
          <img
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt={lesson.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-1" fill="white" />
            </div>
          </div>
        </button>
        <p className="text-sm font-medium mt-2 text-center">{lesson.title}</p>
      </div>
    )
  }

  // Vimeo lesson - plays in-app with embedded player
  if (lesson.type === 'vimeo' && lesson.url) {
    const [isPlaying, setIsPlaying] = useState(false)
    const embedUrl = getVimeoEmbedUrl(lesson.url)
    const thumbnail = useVimeoThumbnail(lesson.url)

    if (isPlaying && embedUrl) {
      return (
        <div className="w-full">
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setIsPlaying(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white z-10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-medium mt-2 text-center">{lesson.title}</p>
        </div>
      )
    }

    return (
      <div className="w-full">
        <button
          onClick={() => setIsPlaying(true)}
          className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted block group"
        >
          {thumbnail && (
            <img
              src={thumbnail}
              alt={lesson.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 rounded-full bg-[#1ab7ea] group-hover:bg-[#0d9bd6] flex items-center justify-center transition-colors">
              <Play className="h-7 w-7 text-white ml-1" fill="white" />
            </div>
          </div>
        </button>
        <p className="text-sm font-medium mt-2 text-center">{lesson.title}</p>
      </div>
    )
  }

  // URL lesson (generic external link)
  if (lesson.type === 'url' && lesson.url) {
    return (
      <a
        href={lesson.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
      >
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          <div className="text-center p-4">
            <Play className="h-10 w-10 mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Open external content</p>
          </div>
        </div>
        <p className="text-sm font-medium mt-2 text-center">{lesson.title}</p>
      </a>
    )
  }

  // Claude audio lesson
  if (lesson.type === 'claude_audio') {
    const isGenerating = claudeAudio.phase === 'generating'
    const isPlaying = claudeAudio.phase === 'speaking'
    const isPaused = claudeAudio.phase === 'paused'
    const hasError = claudeAudio.phase === 'error'

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
      <div className="w-full">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {/* Status icon and message */}
            {isGenerating ? (
              <>
                <Loader2 className="h-10 w-10 text-violet-400 animate-spin mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  {claudeAudio.progress < 50 ? 'Creating your guided session...' : 'Converting to audio...'}
                </p>
                <div className="w-32 h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${claudeAudio.progress}%` }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-muted-foreground"
                  onClick={() => claudeAudio.cancel()}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </>
            ) : (isPlaying || isPaused) ? (
              <>
                {/* Audio visualizer / icon */}
                {isPlaying ? (
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-violet-400 rounded-full animate-pulse"
                        style={{
                          height: `${12 + Math.random() * 20}px`,
                          animationDelay: `${i * 0.1}s`
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Volume2 className="h-8 w-8 text-violet-400 mb-2" />
                )}

                {/* Time display */}
                <p className="text-xs text-muted-foreground mb-2">
                  {formatTime(claudeAudio.currentTime)} / {formatTime(claudeAudio.duration)}
                </p>

                {/* Progress slider */}
                <input
                  type="range"
                  min={0}
                  max={claudeAudio.duration || 100}
                  value={claudeAudio.currentTime}
                  onChange={(e) => claudeAudio.seek(parseFloat(e.target.value))}
                  className="w-full max-w-[200px] h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                />

                {/* Play/Pause and Stop buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => isPlaying ? claudeAudio.pause() : claudeAudio.resume()}
                  >
                    {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    {isPlaying ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => claudeAudio.stop()}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                </div>
              </>
            ) : hasError ? (
              <>
                <p className="text-sm text-destructive mb-2">{claudeAudio.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClaudeAudioPlay}
                >
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={handleClaudeAudioPlay}
                  className="w-14 h-14 rounded-full bg-violet-500 hover:bg-violet-600 flex items-center justify-center transition-colors mb-3"
                >
                  <Volume2 className="h-7 w-7 text-white" />
                </button>
                <p className="text-sm text-muted-foreground text-center">
                  {hasCached ? 'Play audio guide' : 'Generate audio guide'}
                </p>
                {hasCached && (
                  <p className="text-xs text-muted-foreground/70 mt-1">~3-5 min session</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm font-medium">{lesson.title}</p>
          {hasCached && !isGenerating && !isPlaying && !isPaused && (
            <button
              onClick={handleRegenerate}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              title="Regenerate audio with a fresh script"
            >
              <RefreshCw className="h-3 w-3" />
              New
            </button>
          )}
        </div>
      </div>
    )
  }

  // Instructions lesson - uses preset TTS audio guide
  if (lesson.type === 'instructions' && lesson.instructions) {
    const [showAudioMode, setShowAudioMode] = useState(false)
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

    // Get portal container on mount (client-side only)
    useEffect(() => {
      setPortalContainer(document.body)
    }, [])

    return (
      <>
        <div className="w-full">
          <button
            onClick={() => setShowAudioMode(true)}
            className="relative w-full aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 block group"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500 group-hover:bg-emerald-600 flex items-center justify-center transition-colors mb-3">
                <Volume2 className="h-7 w-7 text-white" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Start Audio Guide
              </p>
            </div>
          </button>
          <p className="text-sm font-medium mt-2 text-center">{lesson.title}</p>
        </div>

        {/* Render overlay via portal to escape card container */}
        {showAudioMode && portalContainer && createPortal(
          <AudioInstructionsOverlay
            instructions={lesson.instructions}
            activityName={lesson.title}
            onClose={() => setShowAudioMode(false)}
          />,
          portalContainer
        )}
      </>
    )
  }

  // Tool card lesson - shows tool image with instructions below
  if (lesson.type === 'tool_card') {
    return (
      <div className="w-full">
        {/* Tool image */}
        {lesson.image && (
          <div className="w-full rounded-lg overflow-hidden bg-white border border-border mb-4">
            <img
              src={lesson.image}
              alt={lesson.title}
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2">{lesson.title}</h3>

        {/* Cue - when to use this tool */}
        {lesson.cue && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">When to use:</p>
            <p className="text-sm text-muted-foreground">{lesson.cue}</p>
          </div>
        )}

        {/* What you're fighting against */}
        {lesson.fightingAgainst && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">What you're fighting:</p>
            <p className="text-sm text-muted-foreground">{lesson.fightingAgainst}</p>
          </div>
        )}

        {/* Steps to follow */}
        {lesson.steps && lesson.steps.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">The Tool:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {lesson.steps.map((step, index) => (
                <li key={index} className="text-foreground leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* The higher force */}
        {lesson.higherForce && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1">The higher force:</p>
            <p className="text-sm text-muted-foreground">{lesson.higherForce}</p>
          </div>
        )}

        {/* Other uses (e.g., Inner Authority) */}
        {lesson.otherUses && lesson.otherUses.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Other uses:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {lesson.otherUses.map((use, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-blue-500 shrink-0">•</span>
                  <span>{use}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // Intro card lesson - shows book cover and problem→tool mapping
  if (lesson.type === 'intro_card') {
    const [imageError, setImageError] = useState(false)

    return (
      <div className="w-full">
        {/* Book cover image - show placeholder if missing */}
        {lesson.image && !imageError ? (
          <div className="w-full max-w-[200px] mx-auto rounded-lg overflow-hidden shadow-lg mb-6">
            <img
              src={lesson.image}
              alt={lesson.title}
              className="w-full h-auto"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-full max-w-[200px] mx-auto h-[280px] rounded-lg overflow-hidden shadow-lg mb-6 bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
            <div className="text-center text-white p-4">
              <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-80" />
              <p className="text-lg font-bold">The Tools</p>
              <p className="text-xs opacity-70 mt-1">Phil Stutz</p>
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl font-bold text-center mb-4">{lesson.title}</h3>

        {/* Problem → Tool mappings */}
        {lesson.mappings && lesson.mappings.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-center mb-4">
              What problem are you facing?
            </p>
            <div className="space-y-2">
              {lesson.mappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <span className="text-sm flex-1">{mapping.problem}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-sm font-medium text-primary flex-1 text-right">{mapping.tool}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Swipe to explore each tool →
            </p>
          </div>
        )}
      </div>
    )
  }

  return null
}

interface LessonCardsProps {
  lessons: Lesson[]
  activityId: string
  claudePrompt?: string
}

export function LessonCards({ lessons, activityId, claudePrompt }: LessonCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Minimum swipe distance
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentIndex < lessons.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  const goToNext = () => {
    if (currentIndex < lessons.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  if (lessons.length === 0) return null

  // Determine if this is a tool_card based activity (no header needed, content is self-explanatory)
  const hasToolCards = lessons.some(l => l.type === 'tool_card' || l.type === 'intro_card')

  // Single lesson - no carousel needed
  if (lessons.length === 1) {
    return (
      <div className="space-y-2">
        {!hasToolCards && (
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Guided Session
          </h4>
        )}
        <LessonCard
          lesson={lessons[0]}
          activityId={activityId}
          claudePrompt={claudePrompt}
          isActive={true}
        />
      </div>
    )
  }

  // Multiple lessons - swipeable carousel
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          {hasToolCards ? `${currentIndex + 1} of ${lessons.length}` : `Guided Sessions (${currentIndex + 1}/${lessons.length})`}
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToNext}
            disabled={currentIndex === lessons.length - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Carousel container - only active card is in flow, others are hidden */}
      <div
        ref={containerRef}
        className="relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {lessons.map((lesson, index) => (
          <div
            key={lesson.id}
            className={`w-full px-1 transition-opacity duration-200 ${
              index === currentIndex ? 'relative opacity-100' : 'absolute top-0 left-0 opacity-0 pointer-events-none'
            }`}
          >
            <LessonCard
              lesson={lesson}
              activityId={activityId}
              claudePrompt={claudePrompt}
              isActive={index === currentIndex}
            />
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 pt-2">
        {lessons.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex
                ? 'bg-primary'
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
