import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${origin}?error=supabase_not_configured`)
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handle cookies in edge functions
          }
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Redirect to home with a flag to trigger data migration check
      return NextResponse.redirect(`${origin}${next}?auth_complete=true`)
    }

    console.error('Auth callback error:', error)
    return NextResponse.redirect(`${origin}?error=auth_failed`)
  }

  return NextResponse.redirect(`${origin}?error=no_code`)
}
