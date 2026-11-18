import Link from "next/link"
import DarkModeToggle from "@/components/DarkModeToggle"
import { requestPasswordReset } from "../actions"
import { SubmitButton } from "../submit-button"

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; message?: string }>
}) {
  const params = await searchParams
  const sent = params?.sent === '1'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-8 border border-transparent dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
          {sent ? 'Check your email' : 'Forgot your password?'}
        </h1>

        {sent ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
            If there&apos;s an account for that email, we just sent a link to reset your
            password. It can take a minute to arrive — check your spam folder too.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter your email and we&apos;ll send you a link to choose a new one.
            </p>

            {params?.message && (
              <div className="mb-4 p-4 rounded-lg border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800">
                <p className="text-center text-sm text-red-700 dark:text-red-300">{params.message}</p>
              </div>
            )}

            <form className="space-y-4 mb-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <SubmitButton
                formAction={requestPasswordReset}
                pendingText="Sending..."
                className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors"
              >
                Send reset link
              </SubmitButton>
            </form>
          </>
        )}

        <p className="text-center text-sm">
          <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
