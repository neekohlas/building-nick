'use client'

import { X, Droplets, Wind, Thermometer, Eye, Sun, Sunset, Clock } from 'lucide-react'
import { WeatherDay, WeatherHour, getWeatherEmoji, formatTemp } from '@/hooks/use-weather'

interface WeatherDetailModalProps {
  weather: WeatherDay
  hourly?: WeatherHour[]
  locationName?: string
  onClose: () => void
}

// Format hour from datetime string (e.g., "2024-01-15T14" -> "2 PM")
function formatHour(datetime: string): string {
  // Extract hour from formats like "2024-01-15T14" or "2024-01-15:14"
  const hourMatch = datetime.match(/[T:](\d{2})/)
  if (!hourMatch) return ''
  const hour = parseInt(hourMatch[1], 10)
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

// Get cloud coverage description based on weather code
function getCloudCoverageDescription(weatherId: number): string | null {
  switch (weatherId) {
    case 800: return 'Clear sky (0% cloudy)'
    case 801: return 'Few clouds (11-25% cloudy)'
    case 802: return 'Scattered clouds (25-50% cloudy)'
    case 803: return 'Broken clouds (51-84% cloudy)'
    case 804: return 'Overcast (85-100% cloudy)'
    default: return null
  }
}

export function WeatherDetailModal({ weather, hourly, locationName, onClose }: WeatherDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <span className="text-5xl">{getWeatherEmoji(weather.weather.main, weather.weather.id)}</span>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{formatTemp(weather.temp.max)}</span>
                <span className="text-xl opacity-80">/ {formatTemp(weather.temp.min)}</span>
              </div>
              <p className="text-lg capitalize opacity-90">{weather.weather.description}</p>
              {locationName && (
                <p className="text-sm opacity-75 mt-1">{locationName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Precipitation */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Droplets className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Precipitation</p>
                <p className="font-semibold">{Math.round(weather.pop * 100)}%</p>
              </div>
            </div>

            {/* Feels Like (using max temp as approximation) */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Thermometer className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">High / Low</p>
                <p className="font-semibold">{formatTemp(weather.temp.max)} / {formatTemp(weather.temp.min)}</p>
              </div>
            </div>
          </div>

          {/* Weather Condition */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Conditions</span>
            </div>
            {/* Cloud coverage detail for cloud-related weather codes */}
            {getCloudCoverageDescription(weather.weather.id) && (
              <p className="text-sm font-medium mb-1">
                {getCloudCoverageDescription(weather.weather.id)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {weather.weather.main === 'Clear' && 'Clear skies expected. Great day for outdoor activities!'}
              {weather.weather.main === 'Clouds' && weather.weather.id === 801 && 'Mostly sunny with a few clouds. Great for outdoor activities!'}
              {weather.weather.main === 'Clouds' && weather.weather.id === 802 && 'Partly cloudy skies. Good conditions for outdoor activities.'}
              {weather.weather.main === 'Clouds' && weather.weather.id === 803 && 'Mostly cloudy with some sun breaks. Outdoor activities should be fine.'}
              {weather.weather.main === 'Clouds' && weather.weather.id === 804 && 'Overcast skies. Outdoor activities should still be fine.'}
              {weather.weather.main === 'Rain' && 'Rain expected. Consider indoor alternatives for outdoor activities.'}
              {weather.weather.main === 'Drizzle' && 'Light drizzle possible. Outdoor activities may be affected.'}
              {weather.weather.main === 'Thunderstorm' && 'Thunderstorms expected. Plan for indoor activities.'}
              {weather.weather.main === 'Snow' && 'Snow expected. Dress warmly and consider conditions.'}
              {weather.weather.main === 'Mist' || weather.weather.main === 'Fog' ? 'Low visibility expected. Be cautious with outdoor activities.' : ''}
              {!['Clear', 'Clouds', 'Rain', 'Drizzle', 'Thunderstorm', 'Snow', 'Mist', 'Fog'].includes(weather.weather.main) &&
                `${weather.weather.description}. Check conditions before outdoor activities.`}
            </p>
          </div>

          {/* Hourly Forecast */}
          {hourly && hourly.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Hourly Forecast</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
                {hourly.map((hour, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 flex flex-col items-center p-2 rounded-lg bg-muted/50 min-w-[60px]"
                  >
                    <span className="text-xs text-muted-foreground">{formatHour(hour.datetime)}</span>
                    <span className="text-lg my-1">{getWeatherEmoji(hour.weather.main, hour.weather.id)}</span>
                    <span className="text-sm font-medium">{formatTemp(hour.temp)}</span>
                    {hour.pop > 0.1 && (
                      <span className="text-xs text-blue-500">{Math.round(hour.pop * 100)}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Recommendations */}
          {weather.pop > 0.3 && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Tip:</strong> With {Math.round(weather.pop * 100)}% chance of precipitation,
                you might want to swap outdoor activities for indoor alternatives or reschedule.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
