'use client'

import { SpectrumScores } from '@/lib/activities'

interface SpectrumIconsProps {
  spectrum: SpectrumScores
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Colors for each dimension
const COLORS = {
  heart: '#F43F5E',  // Rose
  mind: '#8B5CF6',   // Purple
  body: '#10B981',   // Emerald
}

// Threshold below which we don't show the icon
const MIN_THRESHOLD = 0.2

// Filled SVG icons (Google Material Design inspired, rounded style)
function HeartIcon({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} opacity={opacity}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function BrainIcon({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  // Lightbulb icon - universally recognized symbol for mind/ideas/thinking
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} opacity={opacity}>
      <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
    </svg>
  )
}

function DumbbellIcon({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  // Filled dumbbell icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} opacity={opacity}>
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/>
    </svg>
  )
}

interface FilledIconProps {
  icon: 'heart' | 'mind' | 'body'
  fillPercent: number  // 0-1
  size: number
}

function FilledIcon({ icon, fillPercent, size }: FilledIconProps) {
  const color = COLORS[icon]
  const clipId = `clip-${icon}-${Math.random().toString(36).substr(2, 9)}`

  // Calculate the unfilled portion (from top)
  const unfilledPercent = 1 - fillPercent

  const IconComponent = icon === 'heart' ? HeartIcon : icon === 'mind' ? BrainIcon : DumbbellIcon

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background icon (faded) */}
      <div className="absolute inset-0">
        <IconComponent size={size} color={color} opacity={0.2} />
      </div>
      {/* Foreground icon (clipped to fill level) */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ overflow: 'hidden' }}
      >
        <defs>
          <clipPath id={clipId}>
            {/* Clip from bottom up based on fill percent */}
            <rect
              x="0"
              y={size * unfilledPercent}
              width={size}
              height={size * fillPercent}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <IconComponent size={size} color={color} opacity={1} />
        </g>
      </svg>
    </div>
  )
}

export function SpectrumIcons({ spectrum, size = 'sm', className = '' }: SpectrumIconsProps) {
  // Larger sizes: sm for compact lists (18px), md for cards (24px), lg for detail views (32px)
  const iconSize = size === 'sm' ? 18 : size === 'md' ? 24 : 32

  // Build array of dimensions that meet threshold, sorted by value descending
  const dimensions: { key: 'heart' | 'mind' | 'body'; value: number }[] = []

  if (spectrum.heart >= MIN_THRESHOLD) {
    dimensions.push({ key: 'heart', value: spectrum.heart })
  }
  if (spectrum.mind >= MIN_THRESHOLD) {
    dimensions.push({ key: 'mind', value: spectrum.mind })
  }
  if (spectrum.body >= MIN_THRESHOLD) {
    dimensions.push({ key: 'body', value: spectrum.body })
  }

  // Sort by value descending (strongest first)
  dimensions.sort((a, b) => b.value - a.value)

  if (dimensions.length === 0) {
    return null
  }

  // Use gap based on size
  const gapClass = size === 'sm' ? 'gap-0.5' : size === 'md' ? 'gap-1' : 'gap-1.5'

  return (
    <div className={`flex flex-col items-center ${gapClass} ${className}`}>
      {dimensions.map(({ key, value }) => (
        <FilledIcon
          key={key}
          icon={key}
          fillPercent={value}
          size={iconSize}
        />
      ))}
    </div>
  )
}
