import { PRODUCT_NAME, PRODUCTION_ORIGIN } from '@woordenaar/domain'
import type { Metadata } from 'next'
import Script from 'next/script'
import { THEME_INITIALIZATION_SCRIPT } from '@/features/settings/theme-script'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: 'A focused workspace for learning Dutch vocabulary.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="h-full antialiased" lang="en" suppressHydrationWarning>
      <body className="min-h-full">
        <Script
          dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }}
          id="theme-initialization"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
