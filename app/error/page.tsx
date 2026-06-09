import Link from "next/link"

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 p-8 border border-transparent dark:border-gray-700 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          We couldn&apos;t finish signing you in. Your link may have expired, or
          something timed out. Please try again — if it keeps happening, contact
          Rosie and we&apos;ll get you sorted out.
        </p>
        <Link
          href="/login"
          className="inline-block w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-indigo-700 transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
