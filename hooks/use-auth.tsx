'use client'

import { createContext, useContext, ReactNode } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase'

// Fixed user ID for single-user mode
// In the future, this will be replaced with real Supabase auth user IDs
// See ROADMAP.md "Feature 7: Multi-User Support" for migration steps
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_DEFAULT_USER_ID

interface AuthState {
  // For single-user mode, we use a fixed user ID instead of real Supabase auth
  userId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isSupabaseEnabled: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const isSupabaseEnabled = isSupabaseConfigured()

  // In single-user mode, we're "authenticated" if Supabase is configured
  // and we have a default user ID
  const userId = DEFAULT_USER_ID || null
  const isAuthenticated = isSupabaseEnabled && !!userId

  return (
    <AuthContext.Provider
      value={{
        userId,
        isLoading: false, // No async auth check needed in single-user mode
        isAuthenticated,
        isSupabaseEnabled,
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
      userId: null,
      isLoading: false,
      isAuthenticated: false,
      isSupabaseEnabled: false,
    }
  }
  return context
}
