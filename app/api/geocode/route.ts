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

  // OpenWeather geocoding API is free and works with any OpenWeather API key
  // We can also use Weatherbit's city parameter, but OpenWeather geocoding gives us coordinates
  const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHERBIT_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Weather API key not configured'
    } as GeocodeResponse)
  }

  // If we only have Weatherbit key, use Nominatim (OpenStreetMap) for geocoding
  const useNominatim = !process.env.OPENWEATHER_API_KEY && process.env.WEATHERBIT_API_KEY

  try {
    // Check if it's a zip code (US format: 5 digits, or with country code like "10001,US")
    const isZipCode = /^\d{5}(,\w{2})?$/.test(query.trim())

    // Use Nominatim (OpenStreetMap) for geocoding - free and doesn't require API key
    if (useNominatim) {
      // Nominatim API (OpenStreetMap) - free geocoding service
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'HabitTrackingApp/1.0' // Nominatim requires a User-Agent
        }
      })

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data || data.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Location not found'
        } as GeocodeResponse)
      }

      const result = data[0]
      const address = result.address || {}

      return NextResponse.json({
        success: true,
        location: {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          name: address.city || address.town || address.village || address.county || result.display_name.split(',')[0],
          country: address.country_code?.toUpperCase() || '',
          state: address.state
        }
      } as GeocodeResponse)
    }

    // Use OpenWeather geocoding API (free)
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
