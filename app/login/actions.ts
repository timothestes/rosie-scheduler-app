'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Derive the site URL from the actual request so confirmation/OAuth links
// are correct in every environment (localhost, preview, production), instead
// of relying on a single NEXT_PUBLIC_SITE_URL env var that can be stale.
async function getSiteUrl() {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function signInWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Supabase returns a vague "Invalid login credentials" both when the
    // password is wrong AND when no account exists yet. Point new users
    // (the common case) toward creating an account.
    const message = /invalid login credentials/i.test(error.message)
      ? "We couldn't sign you in. Double-check your password, or if you're new, use \"Create Account\" above to sign up first."
      : error.message
    redirect(`/login?message=${encodeURIComponent(message)}`)
  }

  redirect('/')
}

export async function signUpWithEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getSiteUrl()}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  // Supabase hides existing-account info to prevent email enumeration: a signup
  // for an already-registered email returns a user with an empty identities
  // array (no error). Steer those users to Sign In instead of telling them to
  // check an inbox that will never get a new confirmation email.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    redirect(
      `/login?message=${encodeURIComponent(
        'An account with this email already exists. Please use "Sign In" above instead.'
      )}`
    )
  }

  redirect('/login?message=Check your email to confirm your account')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  
  // Basic sign in without calendar scope (for students)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await getSiteUrl()}/auth/callback`,
    },
  })

  if (error) {
    redirect('/error')
  }

  if (data.url) {
    redirect(data.url)
  }
}

// Admin-only: Sign in with calendar access for Google Calendar overlay
export async function signInWithGoogleCalendarAccess() {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await getSiteUrl()}/auth/callback`,
      scopes: 'https://www.googleapis.com/auth/calendar.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    redirect('/error')
  }

  if (data.url) {
    redirect(data.url)
  }
}
