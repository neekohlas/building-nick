'use client'

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isSupabaseEnabled: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isSupabaseEnabled = isSupabaseConfigured()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    if (!supabase) {
      setIsLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      console.error('Supabase not configured')
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        isSupabaseEnabled,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    // Return a default state if used outside provider (for backwards compatibility)
    return {
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      isSupabaseEnabled: false,
      signInWithGoogle: async () => {},
      signOut: async () => {},
    }
  }
  return context
}
