export default function CollectionDetailLoading() {
  return (
    <section aria-busy="true" aria-label="Loading collection">
      <div className="h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-6 h-10 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-28 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800"
            key={index}
          />
        ))}
      </div>
      <div className="mt-8 h-80 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
    </section>
  )
}
