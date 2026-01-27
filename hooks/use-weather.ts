'use client'

import { useState, useEffect, useCallback } from 'react'

export interface WeatherDay {
  date: string
  temp: {
    min: number
    max: number
  }
  feels_like: {
    day: number
  }
  humidity: number
  wind_speed: number
  weather: {
    id: number
    main: string
    description: string
    icon: string
  }
  pop: number
  rain?: number
  snow?: number
}

interface WeatherResponse {
  success: boolean
  current?: {
    temp: number
    feels_like: number
    humidity: number
    wind_speed: number
    weather: {
      id: number
      main: string
      description: string
      icon: string
    }
  }
  daily?: WeatherDay[]
  error?: string
  cached?: boolean
}

export interface UserLocation {
  lat: number
  lon: number
  name?: string // Display name for the location
}

// Local storage keys
const LOCATION_CACHE_KEY = 'weather_location'
const LOCATION_NAME_KEY = 'weather_location_name'

// Weather icon mapping
export function getWeatherEmoji(main: string, id?: number): string {
  // Use weather code for more specific icons if available
  if (id) {
    if (id >= 200 && id < 300) return '⛈️' // Thunderstorm
    if (id >= 300 && id < 400) return '🌧️' // Drizzle
    if (id >= 500 && id < 600) return '🌧️' // Rain
    if (id >= 600 && id < 700) return '❄️' // Snow
    if (id >= 700 && id < 800) return '🌫️' // Atmosphere (fog, mist)
    if (id === 800) return '☀️' // Clear
    if (id > 800) return '☁️' // Clouds
  }

  // Fallback to main condition
  switch (main.toLowerCase()) {
    case 'clear': return '☀️'
    case 'clouds': return '☁️'
    case 'rain': return '🌧️'
    case 'drizzle': return '🌧️'
    case 'thunderstorm': return '⛈️'
    case 'snow': return '❄️'
    case 'mist':
    case 'fog':
    case 'haze': return '🌫️'
    default: return '🌤️'
  }
}

// Check if weather is bad for outdoor activities
export function isBadWeatherForOutdoor(weather: WeatherDay): boolean {
  const { id } = weather.weather
  const pop = weather.pop

  // Bad conditions: rain, snow, thunderstorm, or high precipitation probability
  if (id >= 200 && id < 700) return true // Thunderstorm, drizzle, rain, snow
  if (pop > 0.5) return true // >50% chance of precipitation
  if (weather.wind_speed > 20) return true // Very windy

  return false
}

// Format temperature
export function formatTemp(temp: number): string {
  return `${Math.round(temp)}°`
}

// Get cached location from localStorage
function getCachedLocation(): UserLocation | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY)
    const name = localStorage.getItem(LOCATION_NAME_KEY)
    if (cached) {
      const loc = JSON.parse(cached)
      return { ...loc, name: name || undefined }
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

// Save location to localStorage
function cacheLocation(location: UserLocation): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat: location.lat, lon: location.lon }))
    if (location.name) {
      localStorage.setItem(LOCATION_NAME_KEY, location.name)
    } else {
      localStorage.removeItem(LOCATION_NAME_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

// Clear cached location
function clearCachedLocation(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY)
    localStorage.removeItem(LOCATION_NAME_KEY)
  } catch {
    // Ignore storage errors
  }
}

// Get user's location using Geolocation API
async function getUserLocation(): Promise<UserLocation | null> {
  // First check cache
  const cached = getCachedLocation()
  if (cached) {
    return cached
  }

  // Try to get fresh location
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }
        cacheLocation(location)
        resolve(location)
      },
      (error) => {
        console.log('Geolocation error:', error.message)
        resolve(null)
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 1000 * 60 * 60 * 24 // Cache for 24 hours
      }
    )
  })
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<UserLocation | null>(null)

  const fetchWeather = useCallback(async (loc?: UserLocation | null) => {
    try {
      setIsLoading(true)
      setError(null)

      // Build URL with location if available
      let url = '/api/weather'
      if (loc) {
        url += `?lat=${loc.lat}&lon=${loc.lon}`
      }

      const response = await fetch(url)
      const data: WeatherResponse = await response.json()

      if (data.success) {
        setWeather(data)
      } else {
        setError(data.error || 'Failed to fetch weather')
      }
    } catch (err) {
      console.error('Failed to fetch weather:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Get location and fetch weather on mount
  useEffect(() => {
    async function initWeather() {
      const userLocation = await getUserLocation()
      setLocation(userLocation)
      fetchWeather(userLocation)
    }
    initWeather()
  }, [fetchWeather])

  // Get weather for a specific date
  const getWeatherForDate = useCallback((dateStr: string): WeatherDay | undefined => {
    return weather?.daily?.find(d => d.date === dateStr)
  }, [weather])

  // Check if a date has bad weather for outdoor activities
  const hasBadWeather = useCallback((dateStr: string): boolean => {
    const dayWeather = getWeatherForDate(dateStr)
    return dayWeather ? isBadWeatherForOutdoor(dayWeather) : false
  }, [getWeatherForDate])

  // Refetch with current location
  const refetch = useCallback(() => {
    fetchWeather(location)
  }, [fetchWeather, location])

  // Set location manually (from city/zip search)
  const updateLocation = useCallback((newLocation: UserLocation) => {
    cacheLocation(newLocation)
    setLocation(newLocation)
    fetchWeather(newLocation)
  }, [fetchWeather])

  // Clear location and try geolocation again
  const resetLocation = useCallback(async () => {
    clearCachedLocation()
    setLocation(null)

    // Try to get fresh geolocation
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          }
          cacheLocation(loc)
          setLocation(loc)
          fetchWeather(loc)
        },
        () => {
          // If geolocation fails, fetch with default
          fetchWeather(null)
        },
        { enableHighAccuracy: false, timeout: 5000 }
      )
    } else {
      fetchWeather(null)
    }
  }, [fetchWeather])

  return {
    weather,
    current: weather?.current,
    daily: weather?.daily || [],
    isLoading,
    error,
    isCached: weather?.cached || false,
    hasLocation: !!location,
    locationName: location?.name,
    refetch,
    getWeatherForDate,
    hasBadWeather,
    updateLocation,
    resetLocation
  }
}
