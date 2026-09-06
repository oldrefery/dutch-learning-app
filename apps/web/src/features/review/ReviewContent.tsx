'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Review.module.css'

export function ReviewContent({
  focusKey,
  children,
}: {
  focusKey: string
  children: ReactNode
}) {
  const region = useRef<HTMLDivElement>(null)
  useEffect(() => {
    region.current?.focus()
  }, [focusKey])
  return (
    <div
      ref={region}
      tabIndex={-1}
      aria-label="Review content"
      className={styles.sessionBody}
    >
      {children}
    </div>
  )
}
