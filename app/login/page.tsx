'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Lock } from 'lucide-react'

// localStorage key for persisting auth across iOS PWA cookie resets
const AUTH_BACKUP_KEY = 'building_nick_auth_backup'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAutoLogging, setIsAutoLogging] = useState(true)

  // On mount, check if we have a saved password in localStorage (iOS PWA cookie recovery)
  useEffect(() => {
    const savedPassword = localStorage.getItem(AUTH_BACKUP_KEY)
    if (savedPassword) {
      // Try to silently re-authenticate
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: savedPassword })
      }).then(res => {
        if (res.ok) {
          router.push('/')
          router.refresh()
        } else {
          // Saved password no longer valid — clear it
          localStorage.removeItem(AUTH_BACKUP_KEY)
          setIsAutoLogging(false)
        }
      }).catch(() => {
        setIsAutoLogging(false)
      })
    } else {
      setIsAutoLogging(false)
    }
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        // Persist password in localStorage so iOS PWA can recover if cookies are cleared
        localStorage.setItem(AUTH_BACKUP_KEY, password)
        router.push('/')
        router.refresh()
      } else {
        const data = await response.json()
        setError(data.error || 'Invalid password')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading spinner while attempting auto-login from localStorage backup
  if (isAutoLogging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-lg">
          {/* App branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Building Nick</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your password to continue</p>
          </div>

          {/* Login form - structured for password managers */}
          <form onSubmit={handleSubmit} autoComplete="on">
            {/* Hidden username field for password managers */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value="nick"
              readOnly
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />

            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full py-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
