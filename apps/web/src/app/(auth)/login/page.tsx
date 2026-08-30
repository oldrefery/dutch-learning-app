import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { login } from '@/app/(auth)/actions'
import { getSafeNextPath } from '@/lib/auth/navigation'

interface LoginPageProps {
  searchParams: Promise<{ next?: string; message?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const nextPath = getSafeNextPath(params.next ?? null)

  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Sign in to continue learning on the web.
      </p>
      {params.message === 'password-updated' && (
        <p
          className="mt-5 text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          Password updated. Sign in with your new password.
        </p>
      )}
      {params.message === 'oauth-start-failed' && (
        <p className="mt-5 text-sm text-red-600 dark:text-red-400" role="alert">
          Could not start social sign-in. Please try again.
        </p>
      )}
      <AuthForm action={login} mode="login" nextPath={nextPath} />
      <div className="mt-5 flex justify-between gap-4 text-sm">
        <Link className="underline underline-offset-4" href="/forgot-password">
          Forgot password?
        </Link>
        <Link
          className="underline underline-offset-4"
          href={`/signup?next=${encodeURIComponent(nextPath)}`}
        >
          Create account
        </Link>
      </div>
      <div className="my-7 h-px bg-neutral-200 dark:bg-neutral-800" />
      <OAuthButtons nextPath={nextPath} />
    </>
  )
}
