import Link from 'next/link'

export default function SharedCollectionNotFound() {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm font-medium text-neutral-500">Link unavailable</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        This collection is no longer shared
      </h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        Ask the collection owner to publish it again or send you an updated
        link.
      </p>
      <Link
        className="mt-5 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
        href="/app/collections"
      >
        Open my collections
      </Link>
    </section>
  )
}
