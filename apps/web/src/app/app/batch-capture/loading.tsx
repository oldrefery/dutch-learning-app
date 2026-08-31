export default function BatchCaptureLoading() {
  return (
    <section aria-label="Loading batch capture" className="animate-pulse">
      <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-5 h-9 w-64 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-3 h-5 max-w-2xl rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-8 h-96 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
    </section>
  )
}
