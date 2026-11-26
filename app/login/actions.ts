'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, EMAIL_CONFIG } from '@/lib/resend'
import {
  buildAuthEmail,
  buildPasswordLink,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
} from '@/lib/auth-email'
import { DASHBOARD_PATH } from '@/lib/site-routing'

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

  redirect(DASHBOARD_PATH)
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

// Minimum gap between self-service reset emails to the same address, so the
// form can't be used to flood someone's inbox.
const RESET_EMAIL_COOLDOWN_MS = 60_000

async function sendPasswordResetEmail(email: string) {
  const admin = createAdminClient()

  // Profile lookup is best-effort: it gives us a name for the greeting and
  // the auth user id for the cooldown check.
  const { data: profile } = await admin
    .from('users')
    .select('id, full_name')
    .eq('email', email)
    .maybeSingle()

  if (profile?.id) {
    const { data: existing } = await admin.auth.admin.getUserById(profile.id)
    const lastSent = existing?.user?.recovery_sent_at
    if (lastSent && Date.now() - new Date(lastSent).getTime() < RESET_EMAIL_COOLDOWN_MS) {
      return
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  // No account for this email (or a transient failure): send nothing. The
  // caller shows the same message either way.
  if (error || !data?.properties?.hashed_token) return

  // Links must point at our real domain in production — never at a host taken
  // from request headers, which a crafted request could spoof.
  const appUrl = process.env.NODE_ENV === 'production' ? EMAIL_CONFIG.appUrl : await getSiteUrl()

  const { subject, html, text } = buildAuthEmail({
    kind: 'self-reset',
    fullName: profile?.full_name,
    link: buildPasswordLink(appUrl, data.properties.hashed_token),
    appUrl,
  })

  const { error: emailError } = await resend.emails.send({
    from: EMAIL_CONFIG.fromEmail,
    to: email,
    subject,
    html,
    text,
  })
  if (emailError) console.error('Error sending password reset email:', emailError)
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (email) {
    try {
      await sendPasswordResetEmail(email)
    } catch (err) {
      console.error('Password reset request failed:', err)
    }
  }

  // Same response whether or not the account exists, so this form can't be
  // used to discover who has an account.
  redirect(`${FORGOT_PASSWORD_PATH}?sent=1`)
}

export async function resetPassword(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  const backToForm = (message: string): never => {
    const params = new URLSearchParams({ message })
    if (tokenHash) params.set('token_hash', tokenHash)
    redirect(`${RESET_PASSWORD_PATH}?${params}`)
  }

  // Validate before touching the token — it's single-use.
  if (password.length < 6) backToForm('Use at least 6 characters.')
  if (password !== confirm) backToForm("Those passwords don't match. Please try again.")

  const supabase = await createClient()
  const expired = () =>
    redirect(
      `${FORGOT_PASSWORD_PATH}?message=${encodeURIComponent(
        'That link has expired or was already used. Enter your email to get a new one.'
      )}`
    )

  if (tokenHash) {
    // Redeeming the token signs the student in.
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (error) expired()
  } else {
    // No token: only reachable right after a token was redeemed but the
    // password was rejected, in which case the student is already signed in.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) expired()
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    // The token is spent but the session is live, so retry without it.
    redirect(`${RESET_PASSWORD_PATH}?message=${encodeURIComponent(error.message)}`)
  }

  redirect(DASHBOARD_PATH)
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
