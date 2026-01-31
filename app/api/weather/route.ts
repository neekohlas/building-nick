import { NextResponse } from 'next/server'

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
  error?: string
  cached?: boolean
}

// Simple in-memory cache
let cachedWeather: { data: WeatherResponse; timestamp: number } | null = null
const CACHE_DURATION = 3 * 60 * 60 * 1000 // 3 hours in milliseconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Default to San Francisco if no location provided
  // User can override with lat/lon query params
  const lat = searchParams.get('lat') || '37.7749'
  const lon = searchParams.get('lon') || '-122.4194'

  const apiKey = process.env.OPENWEATHER_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'OpenWeather API key not configured'
    } as WeatherResponse)
  }

  // Check cache
  if (cachedWeather && Date.now() - cachedWeather.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      ...cachedWeather.data,
      cached: true
    })
  }

  try {
    // Use One Call API 3.0 for current + 7-day forecast
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=imperial&appid=${apiKey}`

    const response = await fetch(url, {
      next: { revalidate: 10800 } // Cache for 3 hours
    })

    if (!response.ok) {
      // Try fallback to 2.5 API if 3.0 not available
      const fallbackUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
      const fallbackResponse = await fetch(fallbackUrl)

      if (!fallbackResponse.ok) {
        throw new Error(`Weather API error: ${response.status}`)
      }

      const fallbackData = await fallbackResponse.json()

      // Convert 2.5 API format to our format (5-day forecast with 3-hour intervals)
      const dailyMap = new Map<string, any>()

      for (const item of fallbackData.list) {
        const date = item.dt_txt.split(' ')[0]
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            temp: { min: item.main.temp_min, max: item.main.temp_max },
            feels_like: { day: item.main.feels_like },
            humidity: item.main.humidity,
            wind_speed: item.wind.speed,
            weather: item.weather[0],
            pop: item.pop || 0,
            rain: item.rain?.['3h'],
            snow: item.snow?.['3h']
          })
        } else {
          const existing = dailyMap.get(date)
          existing.temp.min = Math.min(existing.temp.min, item.main.temp_min)
          existing.temp.max = Math.max(existing.temp.max, item.main.temp_max)
          existing.pop = Math.max(existing.pop, item.pop || 0)
        }
      }

      const weatherResponse: WeatherResponse = {
        success: true,
        daily: Array.from(dailyMap.values()).slice(0, 7)
      }

      cachedWeather = { data: weatherResponse, timestamp: Date.now() }
      return NextResponse.json(weatherResponse)
    }

    const data = await response.json()

    const weatherResponse: WeatherResponse = {
      success: true,
      current: {
        temp: data.current.temp,
        feels_like: data.current.feels_like,
        humidity: data.current.humidity,
        wind_speed: data.current.wind_speed,
        weather: data.current.weather[0]
      },
      daily: data.daily.slice(0, 8).map((day: any) => {
        // Convert timestamp to local date (using server timezone, which should match user)
        const d = new Date(day.dt * 1000)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const dayNum = String(d.getDate()).padStart(2, '0')
        return {
          date: `${year}-${month}-${dayNum}`,
          temp: {
            min: day.temp.min,
            max: day.temp.max
          },
          feels_like: {
            day: day.feels_like.day
          },
          humidity: day.humidity,
          wind_speed: day.wind_speed,
          weather: day.weather[0],
          pop: day.pop,
          rain: day.rain,
          snow: day.snow
        }
      })
    }

    cachedWeather = { data: weatherResponse, timestamp: Date.now() }
    return NextResponse.json(weatherResponse)

  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch weather'
    } as WeatherResponse)
  }
}
