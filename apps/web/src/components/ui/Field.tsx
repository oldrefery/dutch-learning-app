import { forwardRef, type InputHTMLAttributes } from 'react'

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Field({ className = '', ...props }, ref) {
  return <input className={`dw-field ${className}`} ref={ref} {...props} />
})
