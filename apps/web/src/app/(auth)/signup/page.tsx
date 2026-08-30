import Link from 'next/link'
import { signup } from '@/app/(auth)/actions'
import { AuthForm } from '@/components/auth/AuthForm'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { getSafeNextPath } from '@/lib/auth/navigation'

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const nextPath = getSafeNextPath(params.next ?? null)

  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">
        Create account
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Use the same account as in the mobile application.
      </p>
      <AuthForm action={signup} mode="signup" nextPath={nextPath} />
      <p className="mt-5 text-sm">
        Already registered?{' '}
        <Link
          className="underline underline-offset-4"
          href={`/login?next=${encodeURIComponent(nextPath)}`}
        >
          Sign in
        </Link>
      </p>
      <div className="my-7 h-px bg-neutral-200 dark:bg-neutral-800" />
      <OAuthButtons nextPath={nextPath} />
    </>
  )
}
