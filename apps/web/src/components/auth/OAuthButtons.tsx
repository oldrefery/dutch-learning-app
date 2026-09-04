import styles from './Auth.module.css'

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
    <nav aria-label="Social sign-in" className={styles.oauth}>
      <a href={getOAuthHref('google')}>Continue with Google</a>
      <a href={getOAuthHref('apple')}>Continue with Apple</a>
    </nav>
  )
}
