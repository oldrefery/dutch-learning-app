export default function WordDetailLoading() {
  return (
    <section aria-busy="true" aria-label="Loading word details">
      <div className="h-5 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-6 h-10 w-64 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-8 grid gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-48 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800"
            key={index}
          />
        ))}
      </div>
    </section>
  )
}
