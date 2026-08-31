import Link from 'next/link'

export default function WordNotFound() {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
      <h1 className="text-2xl font-semibold">Word not found</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
        The word does not exist, was deleted, or is not in this collection.
      </p>
      <Link
        className="mt-6 inline-flex rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
        href="/app/collections"
      >
        Back to collections
      </Link>
    </section>
  )
}
