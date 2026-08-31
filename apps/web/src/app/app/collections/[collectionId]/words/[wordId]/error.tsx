'use client'

import { useReportError } from '@/lib/observability/useReportError'

export default function WordDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useReportError(error)

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-950 dark:bg-red-950/30">
      <h1 className="text-xl font-semibold">Could not load this word</h1>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
        Check your connection and try again.
      </p>
      <button
        className="mt-5 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  )
}
