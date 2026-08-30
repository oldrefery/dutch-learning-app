'use client'

export default function HistoryError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950">
      <h1 className="text-lg font-semibold">History could not be loaded</h1>
      <p className="mt-2 text-sm opacity-80">Please try again.</p>
      <button
        className="mt-4 rounded-xl border border-current px-4 py-2 text-sm font-medium"
        onClick={reset}
        type="button"
      >
        Retry
      </button>
    </div>
  )
}
