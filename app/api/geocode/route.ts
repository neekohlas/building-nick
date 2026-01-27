import { NextResponse } from 'next/server'

export interface GeocodeResponse {
  success: boolean
  location?: {
    lat: number
    lon: number
    name: string
    country: string
    state?: string
  }
  error?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({
      success: false,
      error: 'Query parameter "q" is required'
    } as GeocodeResponse)
  }

  const apiKey = process.env.OPENWEATHER_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'OpenWeather API key not configured'
    } as GeocodeResponse)
  }

  try {
    // Check if it's a zip code (US format: 5 digits, or with country code like "10001,US")
    const isZipCode = /^\d{5}(,\w{2})?$/.test(query.trim())

    let url: string
    if (isZipCode) {
      // Use zip code geocoding
      const zipQuery = query.includes(',') ? query : `${query},US`
      url = `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(zipQuery)}&appid=${apiKey}`
    } else {
      // Use direct geocoding for city names
      url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }

    const data = await response.json()

    // Handle zip code response (single object) vs city response (array)
    if (isZipCode) {
      if (!data.lat || !data.lon) {
        return NextResponse.json({
          success: false,
          error: 'Location not found for this zip code'
        } as GeocodeResponse)
      }

      return NextResponse.json({
        success: true,
        location: {
          lat: data.lat,
          lon: data.lon,
          name: data.name,
          country: data.country
        }
      } as GeocodeResponse)
    } else {
      if (!data || data.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Location not found'
        } as GeocodeResponse)
      }

      const result = data[0]
      return NextResponse.json({
        success: true,
        location: {
          lat: result.lat,
          lon: result.lon,
          name: result.name,
          country: result.country,
          state: result.state
        }
      } as GeocodeResponse)
    }

  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to geocode location'
    } as GeocodeResponse)
  }
}
