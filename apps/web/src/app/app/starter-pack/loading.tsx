export default function StarterPackLoading() {
  return (
    <section aria-label="Loading starter pack" className="animate-pulse">
      <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-5 h-9 w-72 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-3 h-5 max-w-2xl rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="h-28 rounded-2xl bg-neutral-200 dark:bg-neutral-800"
            key={index}
          />
        ))}
      </div>
      <div className="mt-6 h-36 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
    </section>
  )
}
