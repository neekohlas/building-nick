'use client'

import { SpectrumScores } from '@/lib/activities'

interface SpectrumTriangleProps {
  spectrum: SpectrumScores
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  className?: string
}

// Colors for each axis
const AXIS_COLORS = {
  heart: '#F43F5E', // Rose red
  mind: '#8B5CF6',  // Purple
  body: '#10B981',  // Emerald green
}

export function SpectrumTriangle({
  spectrum,
  size = 'md',
  showLabels = false,
  className = ''
}: SpectrumTriangleProps) {
  // Size configurations
  const sizes = {
    sm: { width: 32, height: 28, labelOffset: 8 },
    md: { width: 48, height: 42, labelOffset: 12 },
    lg: { width: 80, height: 70, labelOffset: 16 },
  }

  const { width, height, labelOffset } = sizes[size]

  // Triangle vertices (equilateral triangle)
  // Top vertex = Mind, Bottom-left = Heart, Bottom-right = Body
  const centerX = width / 2
  const centerY = height / 2

  // Vertices of the outer triangle (background)
  const topY = size === 'sm' ? 2 : 4
  const bottomY = height - (size === 'sm' ? 2 : 4)
  const leftX = size === 'sm' ? 2 : 4
  const rightX = width - (size === 'sm' ? 2 : 4)

  const vertices = {
    mind: { x: centerX, y: topY },
    heart: { x: leftX, y: bottomY },
    body: { x: rightX, y: bottomY },
  }

  // Calculate the filled triangle points based on spectrum scores
  // Each score (0-1) determines how far along the axis from center to vertex
  const getFilledPoint = (vertex: { x: number; y: number }, score: number) => {
    const x = centerX + (vertex.x - centerX) * score
    const y = centerY + (vertex.y - centerY) * score
    return { x, y }
  }

  const filledPoints = {
    mind: getFilledPoint(vertices.mind, spectrum.mind),
    heart: getFilledPoint(vertices.heart, spectrum.heart),
    body: getFilledPoint(vertices.body, spectrum.body),
  }

  // Create SVG path for the filled area
  const filledPath = `M ${filledPoints.mind.x} ${filledPoints.mind.y} L ${filledPoints.heart.x} ${filledPoints.heart.y} L ${filledPoints.body.x} ${filledPoints.body.y} Z`

  // Create SVG path for the outer triangle
  const outerPath = `M ${vertices.mind.x} ${vertices.mind.y} L ${vertices.heart.x} ${vertices.heart.y} L ${vertices.body.x} ${vertices.body.y} Z`

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="drop-shadow-sm"
      >
        {/* Outer triangle (border) */}
        <path
          d={outerPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === 'sm' ? 1 : 1.5}
          className="text-muted-foreground/30"
        />

        {/* Axis lines from center to vertices */}
        <line
          x1={centerX}
          y1={centerY}
          x2={vertices.mind.x}
          y2={vertices.mind.y}
          stroke={AXIS_COLORS.mind}
          strokeWidth={size === 'sm' ? 0.5 : 1}
          opacity={0.3}
        />
        <line
          x1={centerX}
          y1={centerY}
          x2={vertices.heart.x}
          y2={vertices.heart.y}
          stroke={AXIS_COLORS.heart}
          strokeWidth={size === 'sm' ? 0.5 : 1}
          opacity={0.3}
        />
        <line
          x1={centerX}
          y1={centerY}
          x2={vertices.body.x}
          y2={vertices.body.y}
          stroke={AXIS_COLORS.body}
          strokeWidth={size === 'sm' ? 0.5 : 1}
          opacity={0.3}
        />

        {/* Filled area based on scores */}
        <path
          d={filledPath}
          fill="url(#spectrumGradient)"
          fillOpacity={0.6}
          stroke="url(#spectrumStroke)"
          strokeWidth={size === 'sm' ? 1 : 1.5}
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={AXIS_COLORS.mind} />
            <stop offset="50%" stopColor={AXIS_COLORS.heart} />
            <stop offset="100%" stopColor={AXIS_COLORS.body} />
          </linearGradient>
          <linearGradient id="spectrumStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={AXIS_COLORS.mind} />
            <stop offset="50%" stopColor={AXIS_COLORS.heart} />
            <stop offset="100%" stopColor={AXIS_COLORS.body} />
          </linearGradient>
        </defs>

        {/* Vertex dots */}
        <circle
          cx={vertices.mind.x}
          cy={vertices.mind.y}
          r={size === 'sm' ? 2 : 3}
          fill={AXIS_COLORS.mind}
        />
        <circle
          cx={vertices.heart.x}
          cy={vertices.heart.y}
          r={size === 'sm' ? 2 : 3}
          fill={AXIS_COLORS.heart}
        />
        <circle
          cx={vertices.body.x}
          cy={vertices.body.y}
          r={size === 'sm' ? 2 : 3}
          fill={AXIS_COLORS.body}
        />
      </svg>

      {/* Labels (optional) */}
      {showLabels && (
        <div className="flex justify-between w-full text-[10px] text-muted-foreground mt-1">
          <span style={{ color: AXIS_COLORS.heart }}>Heart</span>
          <span style={{ color: AXIS_COLORS.mind }}>Mind</span>
          <span style={{ color: AXIS_COLORS.body }}>Body</span>
        </div>
      )}
    </div>
  )
}

// Helper component for displaying spectrum as text (accessibility)
export function SpectrumText({ spectrum }: { spectrum: SpectrumScores }) {
  const format = (value: number) => Math.round(value * 100)
  return (
    <span className="sr-only">
      Heart {format(spectrum.heart)}%, Mind {format(spectrum.mind)}%, Body {format(spectrum.body)}%
    </span>
  )
}
