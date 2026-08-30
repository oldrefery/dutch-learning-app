export default function CollectionsLoading() {
  return (
    <section aria-busy="true" aria-label="Loading collections">
      <div className="h-9 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div
            className="h-28 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800"
            key={item}
          />
        ))}
      </div>
      <div className="mt-6 h-32 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
    </section>
  )
}
