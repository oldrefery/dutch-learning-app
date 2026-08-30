import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="text-3xl font-semibold tracking-tight">
          Authentication link failed
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          The link may be invalid or expired. Start the flow again to receive a
          new link.
        </p>
        <Link
          className="mt-7 inline-block rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-950"
          href="/login"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  )
}
