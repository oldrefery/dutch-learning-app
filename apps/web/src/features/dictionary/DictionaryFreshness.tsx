'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Refresh visible content after another tab/device may have changed it.
 * Active review controllers retain their frozen question snapshot. */
export function DictionaryFreshness() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => router.refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [router])
  return null
}
