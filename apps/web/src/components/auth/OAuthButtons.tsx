interface OAuthButtonsProps {
  nextPath: string
}

export function OAuthButtons({ nextPath }: OAuthButtonsProps) {
  const getOAuthHref = (provider: 'google' | 'apple') => {
    const searchParams = new URLSearchParams({
      provider,
      next: nextPath,
    })

    return `/auth/oauth?${searchParams.toString()}`
  }

  return (
    <nav aria-label="Social sign-in" className="mt-6 grid gap-3 sm:grid-cols-2">
      <a
        className="rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm font-medium dark:border-neutral-700"
        href={getOAuthHref('google')}
      >
        Continue with Google
      </a>
      <a
        className="rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm font-medium dark:border-neutral-700"
        href={getOAuthHref('apple')}
      >
        Continue with Apple
      </a>
    </nav>
  )
}
