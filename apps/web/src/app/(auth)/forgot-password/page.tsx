import Link from 'next/link'
import { requestPasswordReset } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/AuthForm'

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">
        Reset password
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        We will email you a secure link to choose a new password.
      </p>
      <AuthForm action={requestPasswordReset} mode="forgot-password" />
      <p className="mt-5 text-sm">
        <Link className="underline underline-offset-4" href="/login">
          Back to sign in
        </Link>
      </p>
    </>
  )
}
