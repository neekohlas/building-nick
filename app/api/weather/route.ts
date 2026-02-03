import { NextResponse } from 'next/server'

export interface WeatherHour {
  datetime: string // YYYY-MM-DD:HH
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
  pop: number // Probability of precipitation (0-100 from Weatherbit, normalized to 0-1)
  precip?: number // Precipitation in mm
  snow?: number // Snow in mm
}

export interface WeatherDay {
  date: string // YYYY-MM-DD
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
    main: string // 'Clear', 'Clouds', 'Rain', 'Snow', etc.
    description: string
    icon: string
  }
  pop: number // Probability of precipitation (0-1)
  rain?: number // Rain volume in mm
  snow?: number // Snow volume in mm
}

export interface WeatherResponse {
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
  hourly?: WeatherHour[]
  error?: string
  cached?: boolean
}

// Simple in-memory cache with location-based key
const weatherCache = new Map<string, { data: WeatherResponse; timestamp: number }>()
const CACHE_DURATION = 3 * 60 * 60 * 1000 // 3 hours in milliseconds

// Map Weatherbit weather codes to a main category for consistency
function getWeatherMain(code: number): string {
  if (code >= 200 && code < 300) return 'Thunderstorm'
  if (code >= 300 && code < 400) return 'Drizzle'
  if (code >= 500 && code < 600) return 'Rain'
  if (code >= 600 && code < 700) return 'Snow'
  if (code >= 700 && code < 800) return 'Atmosphere'
  if (code === 800) return 'Clear'
  if (code > 800) return 'Clouds'
  return 'Unknown'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Default to Seattle if no location provided (user is in PNW)
  const lat = searchParams.get('lat') || '47.6062'
  const lon = searchParams.get('lon') || '-122.3321'

  const apiKey = process.env.WEATHERBIT_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Weatherbit API key not configured'
    } as WeatherResponse)
  }

  // Check cache using location-based key
  const cacheKey = `${lat},${lon}`
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      ...cached.data,
      cached: true
    })
  }

  try {
    // Fetch current weather and daily forecast (required)
    // Hourly forecast is optional (requires paid plan)
    const [currentRes, dailyRes] = await Promise.all([
      fetch(
        `https://api.weatherbit.io/v2.0/current?lat=${lat}&lon=${lon}&units=I&key=${apiKey}`,
        { next: { revalidate: 10800 } }
      ),
      fetch(
        `https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&units=I&days=8&key=${apiKey}`,
        { next: { revalidate: 10800 } }
      )
    ])

    if (!currentRes.ok || !dailyRes.ok) {
      const failedRes = !currentRes.ok ? currentRes : dailyRes
      throw new Error(`Weatherbit API error: ${failedRes.status}`)
    }

    const [currentData, dailyData] = await Promise.all([
      currentRes.json(),
      dailyRes.json()
    ])

    // Try to fetch hourly forecast (optional - requires paid plan)
    let hourlyData: any = { data: [] }
    try {
      const hourlyRes = await fetch(
        `https://api.weatherbit.io/v2.0/forecast/hourly?lat=${lat}&lon=${lon}&units=I&hours=48&key=${apiKey}`,
        { next: { revalidate: 10800 } }
      )
      if (hourlyRes.ok) {
        hourlyData = await hourlyRes.json()
      }
    } catch {
      // Hourly forecast not available on free plan - that's fine
    }

    const current = currentData.data?.[0]

    const weatherResponse: WeatherResponse = {
      success: true,
      current: current ? {
        temp: current.temp,
        feels_like: current.app_temp,
        humidity: current.rh,
        wind_speed: current.wind_spd,
        weather: {
          id: current.weather.code,
          main: getWeatherMain(current.weather.code),
          description: current.weather.description,
          icon: current.weather.icon
        }
      } : undefined,
      daily: dailyData.data?.map((day: any) => ({
        date: day.valid_date,
        temp: {
          min: day.min_temp,
          max: day.max_temp
        },
        feels_like: {
          day: day.app_max_temp // Use apparent max temp as "feels like" for the day
        },
        humidity: day.rh,
        wind_speed: day.wind_spd,
        weather: {
          id: day.weather.code,
          main: getWeatherMain(day.weather.code),
          description: day.weather.description,
          icon: day.weather.icon
        },
        pop: day.pop / 100, // Weatherbit returns 0-100, normalize to 0-1
        rain: day.precip,
        snow: day.snow
      })) || [],
      hourly: hourlyData.data?.map((hour: any) => ({
        datetime: hour.timestamp_local?.slice(0, 13) || hour.datetime, // YYYY-MM-DDTHH format
        temp: hour.temp,
        feels_like: hour.app_temp,
        humidity: hour.rh,
        wind_speed: hour.wind_spd,
        weather: {
          id: hour.weather.code,
          main: getWeatherMain(hour.weather.code),
          description: hour.weather.description,
          icon: hour.weather.icon
        },
        pop: hour.pop / 100, // Normalize to 0-1
        precip: hour.precip,
        snow: hour.snow
      })) || []
    }

    weatherCache.set(cacheKey, { data: weatherResponse, timestamp: Date.now() })
    return NextResponse.json(weatherResponse)

  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch weather'
    } as WeatherResponse)
  }
}
