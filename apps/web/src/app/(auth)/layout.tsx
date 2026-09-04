import { PRODUCT_NAME } from '@woordenaar/domain'
import type { Metadata } from 'next'
import Link from 'next/link'
import styles from '@/components/auth/Auth.module.css'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <Link className={styles.brand} href="/">
          <span className={styles.mark}>W</span>
          {PRODUCT_NAME}
        </Link>
        {children}
      </section>
    </main>
  )
}
