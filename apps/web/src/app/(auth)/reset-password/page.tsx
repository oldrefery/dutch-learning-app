import { updatePassword } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/AuthForm'

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        The reset link must be opened in this browser before submitting.
      </p>
      <AuthForm action={updatePassword} mode="reset-password" />
    </>
  )
}
