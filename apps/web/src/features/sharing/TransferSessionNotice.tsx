'use client'

import { Button } from '@/components/ui/Button'

export function TransferSessionNotice({ ready }: { ready: boolean }) {
  if (!ready) return <p role="status">Checking your account…</p>
  return (
    <div role="alert">
      <p>Account changed. Reload this page before transferring a collection.</p>
      <Button
        onClick={() => window.location.reload()}
        type="button"
        variant="secondary"
      >
        Reload page
      </Button>
    </div>
  )
}
