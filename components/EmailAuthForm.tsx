'use client'

import { useState } from 'react'
import { signInWithEmail, signUpWithEmail } from '@/app/login/actions'

export default function EmailAuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const isSignUp = mode === 'signup'

  return (
    <div>
      {/* Mode toggle — makes it obvious which action the button will take.
          Inactive tabs stay high-contrast so neither reads as "disabled". */}
      <div className="grid grid-cols-2 gap-1 p-1 mb-5 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <button
          type="button"
          onClick={() => setMode('signin')}
          aria-pressed={!isSignUp}
          className={`py-2.5 rounded-md text-sm font-semibold transition-colors ${
            !isSignUp
              ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-700 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          aria-pressed={isSignUp}
          className={`py-2.5 rounded-md text-sm font-semibold transition-colors ${
            isSignUp
              ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-700 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60'
          }`}
        >
          Create Account
        </button>
      </div>

      <form className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="••••••••"
          />
          {isSignUp && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use at least 6 characters.
            </p>
          )}
        </div>

        <button
          formAction={isSignUp ? signUpWithEmail : signInWithEmail}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors"
        >
          {isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm mt-4 text-gray-600 dark:text-gray-400">
        {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
        <button
          type="button"
          onClick={() => setMode(isSignUp ? 'signin' : 'signup')}
          className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
        >
          {isSignUp ? 'Sign in instead' : 'Create an account'}
        </button>
      </p>
    </div>
  )
}
