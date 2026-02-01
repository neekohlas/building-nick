'use client'

import { Heart, Brain, Dumbbell } from 'lucide-react'
import { SpectrumScores } from '@/lib/activities'

interface SpectrumIconsProps {
  spectrum: SpectrumScores
  size?: 'sm' | 'md'
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

interface FilledIconProps {
  icon: 'heart' | 'mind' | 'body'
  fillPercent: number  // 0-1
  size: number
}

function FilledIcon({ icon, fillPercent, size }: FilledIconProps) {
  const color = COLORS[icon]
  const IconComponent = icon === 'heart' ? Heart : icon === 'mind' ? Brain : Dumbbell
  const clipId = `clip-${icon}-${Math.random().toString(36).substr(2, 9)}`

  // Calculate the unfilled portion (from top)
  const unfilledPercent = 1 - fillPercent

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background icon (faded) */}
      <IconComponent
        className="absolute inset-0"
        style={{
          width: size,
          height: size,
          color: color,
          opacity: 0.25,
        }}
      />
      {/* Foreground icon (clipped to fill level) */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
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
          <foreignObject x="0" y="0" width={size} height={size}>
            <IconComponent
              style={{
                width: size,
                height: size,
                color: color,
              }}
            />
          </foreignObject>
        </g>
      </svg>
    </div>
  )
}

export function SpectrumIcons({ spectrum, size = 'sm', className = '' }: SpectrumIconsProps) {
  const iconSize = size === 'sm' ? 14 : 18

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

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
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
