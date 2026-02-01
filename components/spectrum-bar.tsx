'use client'

import { SpectrumScores } from '@/lib/activities'

interface SpectrumBarProps {
  spectrum: SpectrumScores
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Colors for each dimension
const COLORS = {
  heart: '#F43F5E',  // Rose - emotional/relational
  mind: '#8B5CF6',   // Purple - cognitive/focus
  body: '#10B981',   // Emerald - movement/physical
}

// Threshold below which we don't show a segment
const MIN_THRESHOLD = 0.2

// SVG Icons for each dimension (rendered lighter/white to stand out against color)
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function MindIcon({ className }: { className?: string }) {
  // Lightbulb icon
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
    </svg>
  )
}

function BodyIcon({ className }: { className?: string }) {
  // Dumbbell icon
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/>
    </svg>
  )
}

const ICONS = {
  heart: HeartIcon,
  mind: MindIcon,
  body: BodyIcon,
}

export function SpectrumBar({ spectrum, size = 'sm', className = '' }: SpectrumBarProps) {
  // Bar height and icon sizes based on size prop - thicker bars to embed icons
  const barHeight = size === 'sm' ? 14 : size === 'md' ? 18 : 22
  const iconSize = size === 'sm' ? 10 : size === 'md' ? 12 : 16
  const iconPadding = (barHeight - iconSize) / 2

  // Filter out dimensions below threshold
  const dimensions: { key: 'heart' | 'mind' | 'body'; value: number }[] = []

  if (spectrum.heart > MIN_THRESHOLD) {
    dimensions.push({ key: 'heart', value: spectrum.heart })
  }
  if (spectrum.mind > MIN_THRESHOLD) {
    dimensions.push({ key: 'mind', value: spectrum.mind })
  }
  if (spectrum.body > MIN_THRESHOLD) {
    dimensions.push({ key: 'body', value: spectrum.body })
  }

  if (dimensions.length === 0) {
    return null
  }

  // Calculate total for proportional widths
  const total = dimensions.reduce((sum, d) => sum + d.value, 0)

  // Sort by value descending (largest segment first/leftmost)
  const sortedDimensions = [...dimensions].sort((a, b) => b.value - a.value)

  // Build gradient stops with smooth transitions
  const gradientStops: string[] = []
  let currentPercent = 0

  sortedDimensions.forEach((dim, index) => {
    const width = (dim.value / total) * 100
    const color = COLORS[dim.key]

    if (index === 0) {
      // First color starts at 0
      gradientStops.push(`${color} 0%`)
    }

    // Add transition zone (blend with next color if there is one)
    const endPercent = currentPercent + width
    const nextDim = sortedDimensions[index + 1]

    if (nextDim) {
      // Create a tighter blend at the transition point (2% zone)
      const transitionWidth = 2
      gradientStops.push(`${color} ${endPercent - transitionWidth}%`)
      gradientStops.push(`${COLORS[nextDim.key]} ${endPercent + transitionWidth}%`)
    } else {
      // Last color goes to 100%
      gradientStops.push(`${color} 100%`)
    }

    currentPercent = endPercent
  })

  // Calculate icon positions (at the center of each segment)
  const iconPositions: { key: 'heart' | 'mind' | 'body'; percent: number; width: number }[] = []
  currentPercent = 0

  sortedDimensions.forEach((dim) => {
    const width = (dim.value / total) * 100
    const centerPercent = currentPercent + width / 2
    iconPositions.push({ key: dim.key, percent: centerPercent, width })
    currentPercent += width
  })

  // Calculate segment positions for icon pattern overlay
  const segmentPositions: { key: 'heart' | 'mind' | 'body'; startPercent: number; endPercent: number }[] = []
  currentPercent = 0
  sortedDimensions.forEach((dim) => {
    const width = (dim.value / total) * 100
    segmentPositions.push({
      key: dim.key,
      startPercent: currentPercent,
      endPercent: currentPercent + width
    })
    currentPercent += width
  })

  // Icon spacing for repeating pattern (gap between icons)
  const iconGap = iconSize * 0.8

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        height: barHeight,
        background: `linear-gradient(to right, ${gradientStops.join(', ')})`,
      }}
    >
      {/* Repeating icon pattern for each segment */}
      {segmentPositions.map(({ key, startPercent, endPercent }) => {
        const Icon = ICONS[key]

        return (
          <div
            key={key}
            className="absolute top-0 bottom-0 flex items-center overflow-hidden"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            {/* Use a wide inner container that definitely overflows */}
            <div
              className="flex items-center h-full"
              style={{
                gap: iconGap,
                paddingLeft: iconGap / 2,
                width: '2000px', // Force wide container
              }}
            >
              {Array.from({ length: 150 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0"
                  style={{ width: iconSize, height: iconSize }}
                >
                  <Icon className="w-full h-full" />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Also export the colors for use elsewhere
export { COLORS as SPECTRUM_COLORS }
