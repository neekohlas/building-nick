'use client'

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useStatistics, WeekStats, MoodEntry } from '@/hooks/use-statistics'
import { SpectrumScores } from '@/lib/activities'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

// Format minutes as hours + minutes (e.g., 210 → "3h 30m", 45 → "45m", 120 → "2h")
function formatMinutesDisplay(mins: number): { value: string; unit: string } {
  const rounded = Math.round(mins)
  if (rounded < 60) return { value: `${rounded}`, unit: 'm' }
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (m === 0) return { value: `${h}`, unit: 'h' }
  return { value: `${h}h ${m}`, unit: 'm' }
}

function formatMinutesShort(mins: number): string {
  const rounded = Math.round(mins)
  if (rounded < 60) return `${rounded}m`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// Spectrum colors (matching spectrum-bar.tsx)
const SPECTRUM_COLORS = {
  heart: '#F43F5E',
  mind: '#8B5CF6',
  body: '#10B981',
  learn: '#F59E0B',
}

const SPECTRUM_LABELS = {
  heart: 'Heart',
  mind: 'Mind',
  body: 'Body',
  learn: 'Learn',
}

// Small icons for spectrum dimensions
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}
function MindIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86zm2-15.86c1.03.13 2 .45 2.87.93H13v-.93zM13 7h5.24c.25.31.48.65.68 1H13V7zm0 3h6.74c.08.33.15.66.19 1H13v-1zm0 9.93V19h2.87c-.87.48-1.84.8-2.87.93zM18.24 17H13v-1h5.92c-.2.35-.43.69-.68 1zm1.5-3H13v-1h6.93c-.04.34-.11.67-.19 1z"/>
    </svg>
  )
}
function BodyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/>
    </svg>
  )
}
function LearnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
    </svg>
  )
}

const SPECTRUM_ICONS = {
  heart: HeartIcon,
  mind: MindIcon,
  body: BodyIcon,
  learn: LearnIcon,
}

type DimensionKey = keyof SpectrumScores

interface StatisticsViewProps {
  onBack: () => void
}

function formatDateRange(start: Date, end: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const startMonth = months[start.getMonth()]
  const endMonth = months[end.getMonth()]

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}`
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}`
}

// Custom tooltip for the chart
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)
  if (total === 0) return null

  // Convert numeric x position to day name (round to nearest integer)
  const dayIndex = typeof label === 'number' ? Math.round(label) : -1
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayName = dayIndex >= 0 && dayIndex <= 6 ? dayLabels[dayIndex] : ''
  if (!dayName) return null

  return (
    <div className="bg-card border rounded-lg shadow-lg p-2 text-xs">
      <p className="font-medium mb-1">{dayName}</p>
      {payload.filter(p => p.value > 0).map(p => (
        <div key={p.name} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium">{formatMinutesShort(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-border/50 mt-1 pt-1 font-medium">
        Total: {formatMinutesShort(total)}
      </div>
    </div>
  )
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function WeeklyChart({ weekStats }: { weekStats: WeekStats }) {
  // Get today's date string to cap cumulative data (future days show as blank)
  const todayStr = new Date().toISOString().split('T')[0]

  // Build cumulative values per day
  type CumDay = { heart: number; mind: number; body: number; learn: number; total: number }
  const cumDays: (CumDay | null)[] = []
  let cumHeart = 0, cumMind = 0, cumBody = 0, cumLearn = 0
  let daysElapsed = 0

  for (let i = 0; i < weekStats.days.length; i++) {
    const day = weekStats.days[i]
    if (day.date > todayStr) {
      cumDays.push(null) // future
    } else {
      daysElapsed++
      cumHeart += day.spectrumMinutes.heart
      cumMind += day.spectrumMinutes.mind
      cumBody += day.spectrumMinutes.body
      cumLearn += day.spectrumMinutes.learn
      const total = cumHeart + cumMind + cumBody + cumLearn
      cumDays.push({
        heart: Math.round(cumHeart * 10) / 10,
        mind: Math.round(cumMind * 10) / 10,
        body: Math.round(cumBody * 10) / 10,
        learn: Math.round(cumLearn * 10) / 10,
        total,
      })
    }
  }

  // Project Y-axis max: extrapolate current pace to full 7 days
  // Use at least 1.5x current total so there's always headroom
  const currentTotal = cumHeart + cumMind + cumBody + cumLearn
  let projectedMax: number
  if (daysElapsed > 0 && daysElapsed < 7) {
    const dailyAvg = currentTotal / daysElapsed
    projectedMax = Math.ceil(dailyAvg * 7)
  } else {
    projectedMax = currentTotal
  }
  // Ensure some minimum headroom (at least 1.3x current, minimum 60)
  const yMax = Math.max(Math.ceil(currentTotal * 1.3), projectedMax, 60)
  // Round up to nice number (nearest 30)
  const yMaxRounded = Math.ceil(yMax / 30) * 30

  // Build chart data with angled midpoint transitions
  // For each day the shape is: diagonal ramp from midpoint to day label, then flat plateau.
  //   x = i-0.5 → previous day's cumulative value (bottom of ramp)
  //   x = i     → this day's cumulative value (top of ramp, at the day label)
  //   x = i+0.5 → this day's cumulative value (flat plateau continues)
  // The diagonal line from (i-0.5, prev) to (i, current) creates the angled transition.
  const zero = { heart: 0, mind: 0, body: 0, learn: 0 }
  const chartData: Array<{ x: number; heart: number | null; mind: number | null; body: number | null; learn: number | null }> = []

  // Leading zero baseline: flat at 0 from x=-1 to x=-0.5
  // The ramp from x=-0.5 (0) to x=0 (Mon's value) is the "starts at 0" rise
  chartData.push({ x: -1, ...zero })
  chartData.push({ x: -0.5, ...zero })

  for (let i = 0; i < 7; i++) {
    const cum = cumDays[i]

    if (cum === null) {
      // Future day — null out the rest so X-axis labels still show
      for (let j = i; j < 7; j++) {
        chartData.push({ x: j, heart: null, mind: null, body: null, learn: null })
      }
      chartData.push({ x: 6.5, heart: null, mind: null, body: null, learn: null })
      break
    }

    // Day label position (i): diagonal ramp arrives at this day's value
    chartData.push({ x: i, heart: cum.heart, mind: cum.mind, body: cum.body, learn: cum.learn })

    // Right edge (i+0.5): flat plateau at this day's value
    // This also serves as the bottom of the next day's ramp
    chartData.push({ x: i + 0.5, heart: cum.heart, mind: cum.mind, body: cum.body, learn: cum.learn })
  }

  // If all 7 days had data, ensure trailing point
  if (cumDays[6] !== null && chartData[chartData.length - 1]?.x !== 6.5) {
    const last = cumDays[6]!
    chartData.push({ x: 6.5, heart: last.heart, mind: last.mind, body: last.body, learn: last.learn })
  }

  // Check if there's any data
  const hasData = currentTotal > 0

  if (!hasData) {
    return (
      <div className="w-full h-[180px] flex items-center justify-center text-sm text-muted-foreground">
        No activity this week
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="x"
          type="number"
          domain={[-1, 6.5]}
          ticks={[0, 1, 2, 3, 4, 5, 6]}
          tickFormatter={(v: number) => DAY_LABELS[v] ?? ''}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, yMaxRounded]}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          width={32}
          tickFormatter={(v: number) => v >= 60 ? `${Math.round(v / 60)}h` : `${v}`}
        />
        <Tooltip content={<ChartTooltip />} cursor={false} />
        <Area type="linear" dataKey="learn" stackId="1" fill={SPECTRUM_COLORS.learn} stroke={SPECTRUM_COLORS.learn} fillOpacity={0.85} connectNulls={false} />
        <Area type="linear" dataKey="body" stackId="1" fill={SPECTRUM_COLORS.body} stroke={SPECTRUM_COLORS.body} fillOpacity={0.85} connectNulls={false} />
        <Area type="linear" dataKey="mind" stackId="1" fill={SPECTRUM_COLORS.mind} stroke={SPECTRUM_COLORS.mind} fillOpacity={0.85} connectNulls={false} />
        <Area type="linear" dataKey="heart" stackId="1" fill={SPECTRUM_COLORS.heart} stroke={SPECTRUM_COLORS.heart} fillOpacity={0.85} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function SpectrumBreakdown({ spectrumTotals }: { spectrumTotals: SpectrumScores }) {
  const dimensions: DimensionKey[] = ['heart', 'mind', 'body', 'learn']
  const maxValue = Math.max(...dimensions.map(d => spectrumTotals[d] || 0), 1)

  return (
    <div className="space-y-2.5">
      {dimensions.map(dim => {
        const value = spectrumTotals[dim] || 0
        const Icon = SPECTRUM_ICONS[dim]
        const widthPercent = (value / maxValue) * 100

        return (
          <div key={dim} className="flex items-center gap-2.5">
            <div className="w-5 h-5 shrink-0" style={{ color: SPECTRUM_COLORS[dim] }}>
              <Icon className="w-full h-full" />
            </div>
            <span className="text-xs font-medium w-10 shrink-0">{SPECTRUM_LABELS[dim]}</span>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              {value > 0 && (
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(widthPercent, 4)}%`,
                    backgroundColor: SPECTRUM_COLORS[dim],
                  }}
                />
              )}
            </div>
            <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
              {value > 0 ? formatMinutesShort(value) : '–'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ActivityList({ breakdown }: { breakdown: WeekStats['activityBreakdown'] }) {
  if (breakdown.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No completed activities this week
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {breakdown.map(ab => (
        <div
          key={ab.activityId}
          className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Spectrum dot showing dominant color */}
            {ab.spectrum && (
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: getDominantColor(ab.spectrum),
                }}
              />
            )}
            <span className="text-sm font-medium truncate">{ab.activityName}</span>
          </div>
          <div className="text-sm text-muted-foreground shrink-0 ml-3">
            <span className="font-semibold text-foreground">{ab.sessionCount}x</span>
            <span className="mx-1">·</span>
            <span>~{formatMinutesShort(ab.estimatedMinutes)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function getDominantColor(spectrum: SpectrumScores): string {
  const dims: DimensionKey[] = ['heart', 'mind', 'body', 'learn']
  let maxDim: DimensionKey = 'mind'
  let maxVal = 0
  for (const d of dims) {
    if ((spectrum[d] || 0) > maxVal) {
      maxVal = spectrum[d] || 0
      maxDim = d
    }
  }
  return SPECTRUM_COLORS[maxDim]
}

// Mood category display config (matches health-coach-modal.tsx)
const MOOD_CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
  energized: { label: 'Energized', emoji: '✨', color: '#F59E0B' },
  calm: { label: 'Calm', emoji: '😌', color: '#10B981' },
  meh: { label: 'Meh', emoji: '😐', color: '#8B8B8B' },
  stressed: { label: 'Stressed', emoji: '😤', color: '#EF4444' },
  down: { label: 'Down', emoji: '😔', color: '#6366F1' },
}

const SHORT_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function MoodTimeline({ moodEntries, weekStats }: { moodEntries: MoodEntry[]; weekStats: WeekStats }) {
  if (moodEntries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No mood check-ins this week. Use the Health Coach to log how you're feeling.
      </p>
    )
  }

  // Create a map of date -> mood entry
  const moodByDate = new Map(moodEntries.map(m => [m.date, m]))

  return (
    <div className="space-y-2">
      {/* Day-by-day mood dots */}
      <div className="flex items-center justify-between px-1">
        {weekStats.days.map(day => {
          const mood = moodByDate.get(day.date)
          const cat = mood ? MOOD_CATEGORIES[mood.category] : null

          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{day.dayName}</span>
              {cat ? (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base transition-all"
                  style={{ backgroundColor: `${cat.color}20`, border: `2px solid ${cat.color}` }}
                  title={`${cat.label}${mood?.emotion ? ` — ${mood.emotion}` : ''}`}
                >
                  {cat.emoji}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted/50 border-2 border-transparent flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">–</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detailed entries below */}
      <div className="space-y-1.5 pt-1">
        {moodEntries
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(entry => {
            const cat = MOOD_CATEGORIES[entry.category]
            if (!cat) return null

            const dateObj = new Date(entry.date + 'T12:00:00')
            const dayIdx = (dateObj.getDay() + 6) % 7 // Mon=0
            const dayName = SHORT_DAY_NAMES[dayIdx]

            return (
              <div
                key={entry.date}
                className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
                style={{ backgroundColor: `${cat.color}08` }}
              >
                <span className="text-sm shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-medium" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                    {entry.emotion && (
                      <span className="text-xs text-muted-foreground">
                        · {entry.emotion}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{dayName}</span>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.notes}</p>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

export function StatisticsView({ onBack }: StatisticsViewProps) {
  const {
    weekStats,
    isLoading,
    isCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
  } = useStatistics()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold">Weekly Statistics</h2>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          {weekStats ? (
            <>
              <p className="text-sm font-semibold">
                {formatDateRange(weekStats.weekStart, weekStats.weekEnd)}
              </p>
              {isCurrentWeek && (
                <p className="text-xs text-muted-foreground">This week</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </div>
        <button
          onClick={goToNextWeek}
          disabled={isCurrentWeek}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : weekStats ? (
        <div className="space-y-5">
          {/* Chart Card */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Zone Time
              </h3>
              <div className="text-right">
                {(() => {
                  const { value, unit } = formatMinutesDisplay(weekStats.totalMinutes)
                  return (
                    <>
                      <span className="text-2xl font-bold">{value}</span>
                      <span className="text-sm text-muted-foreground ml-1">{unit}</span>
                    </>
                  )
                })()}
                {weekStats.totalSessions > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {weekStats.totalSessions} sessions
                  </p>
                )}
              </div>
            </div>

            <WeeklyChart weekStats={weekStats} />

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-3">
              {(['heart', 'mind', 'body', 'learn'] as DimensionKey[]).map(dim => (
                <div key={dim} className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: SPECTRUM_COLORS[dim] }}
                  />
                  <span className="text-[10px] text-muted-foreground capitalize">{dim}</span>
                </div>
              ))}
            </div>

          </div>

          {/* Spectrum Breakdown */}
          {weekStats.totalSessions > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Spectrum Breakdown
                </h3>
                <span className="text-[10px] text-muted-foreground">weighted</span>
              </div>
              <SpectrumBreakdown spectrumTotals={weekStats.spectrumTotals} />
            </div>
          )}

          {/* Mood Timeline */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Mood Check-ins
            </h3>
            <MoodTimeline moodEntries={weekStats.moodEntries} weekStats={weekStats} />
          </div>

          {/* Activity Breakdown */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Activities
            </h3>
            <ActivityList breakdown={weekStats.activityBreakdown} />
          </div>

        </div>
      ) : null}
    </div>
  )
}
