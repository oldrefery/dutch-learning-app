import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: ButtonVariant
}

export function Button({
  children,
  className = '',
  disabled,
  loading = false,
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={`dw-button dw-button--${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span aria-hidden="true">◴</span>}
      {children}
    </button>
  )
}
