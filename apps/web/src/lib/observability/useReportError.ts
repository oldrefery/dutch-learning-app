'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
}
