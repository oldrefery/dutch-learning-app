'use client'

export default function CollectionsError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
      <h1 className="text-lg font-semibold">Collections are unavailable</h1>
      <p className="mt-2 text-sm text-red-800 dark:text-red-200">
        We could not load your collections. Your data has not been changed.
      </p>
      <button
        className="mt-5 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium dark:border-red-800"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  )
}
