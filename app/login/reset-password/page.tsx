import Link from "next/link"
import DarkModeToggle from "@/components/DarkModeToggle"
import { createClient } from "@/lib/supabase/server"
import { resetPassword } from "../actions"
import { SubmitButton } from "../submit-button"

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; message?: string }>
}) {
  const params = await searchParams
  const tokenHash = params?.token_hash ?? ''

  // Without a token the form only works for someone already signed in (see
  // resetPassword). Don't redeem the token here: it must survive email
  // scanners that pre-open links.
  let canSubmit = Boolean(tokenHash)
  if (!canSubmit) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    canSubmit = Boolean(user)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-8 border border-transparent dark:border-gray-700">
        {canSubmit ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
              Choose a password
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              You&apos;ll use it with your email to sign in from now on.
            </p>

            {params?.message && (
              <div className="mb-4 p-4 rounded-lg border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800">
                <p className="text-center text-sm text-red-700 dark:text-red-300">{params.message}</p>
              </div>
            )}

            <form className="space-y-4">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use at least 6 characters.</p>
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
              <SubmitButton
                formAction={resetPassword}
                pendingText="Saving..."
                className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors"
              >
                Save password and sign in
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
              This link isn&apos;t valid
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              It may be incomplete or already used. You can request a fresh one.
            </p>
            <Link
              href="/login/forgot-password"
              className="block w-full text-center bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors"
            >
              Get a new link
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
