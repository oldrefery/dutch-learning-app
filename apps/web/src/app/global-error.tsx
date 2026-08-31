'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-50">
        <main className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-neutral-300">
            The application encountered an unexpected error. Please try again.
          </p>
          <button
            className="mt-6 rounded-xl bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-950"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
