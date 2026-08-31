import { PRODUCT_NAME, PRODUCTION_ORIGIN } from '@woordenaar/domain'
import { REQUIRED_PUBLIC_TABLES } from '@/lib/backend-contract'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-neutral-500 uppercase dark:text-neutral-400">
          Web foundation
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          {PRODUCT_NAME}
        </h1>
        <p className="mt-5 text-lg leading-8 text-neutral-600 dark:text-neutral-300">
          The Next.js workspace is ready. Product UI will be implemented from
          the approved design while sharing the existing Supabase backend and
          framework-independent contracts.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-950"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-700"
            href="/signup"
          >
            Create account
          </Link>
        </div>
      </div>

      <section
        aria-labelledby="foundation-status"
        className="mt-12 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <h2 id="foundation-status" className="text-lg font-semibold">
          Foundation status
        </h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">
              Production origin
            </dt>
            <dd className="mt-1 font-mono text-sm">{PRODUCTION_ORIGIN}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">
              Typed backend tables
            </dt>
            <dd className="mt-1 text-sm">{REQUIRED_PUBLIC_TABLES.length}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
