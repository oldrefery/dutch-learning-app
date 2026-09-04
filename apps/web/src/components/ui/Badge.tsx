import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'destructive'

export function Badge({
  children,
  className = '',
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: BadgeTone
}) {
  const toneClass = tone === 'neutral' ? '' : ` dw-chip--${tone}`
  return <span className={`dw-chip${toneClass} ${className}`}>{children}</span>
}
