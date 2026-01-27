'use client'

import { useState } from 'react'
import { X, MapPin, Search, Navigation, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { UserLocation } from '@/hooks/use-weather'

interface GeocodeResponse {
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

interface LocationModalProps {
  currentLocation?: string
  onClose: () => void
  onUpdateLocation: (location: UserLocation) => void
  onResetLocation: () => void
}

export function LocationModal({
  currentLocation,
  onClose,
  onUpdateLocation,
  onResetLocation
}: LocationModalProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const handleSearch = async () => {
    console.log('handleSearch called, query:', query)
    if (!query.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const url = `/api/geocode?q=${encodeURIComponent(query.trim())}`
      console.log('Fetching:', url)
      const response = await fetch(url)
      console.log('Response status:', response.status)
      const data: GeocodeResponse = await response.json()

      if (data.success && data.location) {
        const displayName = data.location.state
          ? `${data.location.name}, ${data.location.state}`
          : `${data.location.name}, ${data.location.country}`

        onUpdateLocation({
          lat: data.location.lat,
          lon: data.location.lon,
          name: displayName
        })
        onClose()
      } else {
        setError(data.error || 'Location not found')
      }
    } catch (err) {
      console.error('Geocode error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search for location')
    } finally {
      setIsSearching(false)
    }
  }

  const handleReset = async () => {
    setIsResetting(true)
    await onResetLocation()
    setIsResetting(false)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

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
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Weather Location</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Location */}
          {currentLocation && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Current location</p>
              <p className="font-medium">{currentLocation}</p>
            </div>
          )}

          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Enter city or zip code</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. New York or 10001"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                size="icon"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Use Device Location */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              Use device location
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              This will request location permission from your browser
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
