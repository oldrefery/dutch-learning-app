import { PRODUCT_NAME } from '@woordenaar/domain'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <Link className="text-sm font-semibold tracking-wide" href="/">
          {PRODUCT_NAME}
        </Link>
        {children}
      </section>
    </main>
  )
}
