import { PRODUCT_NAME, PRODUCTION_ORIGIN } from '@woordenaar/domain'
import type { Metadata } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import Script from 'next/script'
import type { CSSProperties } from 'react'
import { THEME_INITIALIZATION_SCRIPT } from '@/features/settings/theme-script'
import './globals.css'

const archivo = Archivo({
  display: 'swap',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const ibmPlexMono = IBM_Plex_Mono({
  display: 'swap',
  subsets: ['latin'],
  weight: ['400', '500'],
})

type FontProperties = CSSProperties & {
  '--font-archivo': string
  '--font-plex-mono': string
}

const fontProperties: FontProperties = {
  '--font-archivo': archivo.style.fontFamily,
  '--font-plex-mono': ibmPlexMono.style.fontFamily,
}

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  alternates: { canonical: '/' },
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
    <html
      className="h-full antialiased"
      lang="en"
      style={fontProperties}
      suppressHydrationWarning
    >
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
