import type { WordDetail } from '@/features/words/word-detail'

export type ReviewDetailResult =
  { status: 'success'; word: WordDetail } | { status: 'error'; message: string }

const MAX_ENTRIES = 50

export class ReviewDetailCache {
  private readonly entries = new Map<string, Promise<ReviewDetailResult>>()

  load(
    userId: string,
    wordId: string,
    revision: number,
    signal: AbortSignal
  ): Promise<ReviewDetailResult> {
    const key = `${userId}:${wordId}:${revision}`
    const existing = this.entries.get(key)
    if (existing) return existing

    const request = fetch(`/api/review/words/${encodeURIComponent(wordId)}`, {
      signal,
      cache: 'no-store',
    })
      .then(async response => {
        const result = (await response.json()) as ReviewDetailResult
        if (!response.ok || result.status !== 'success') return result
        return result
      })
      .catch((): ReviewDetailResult => ({
        status: 'error',
        message: 'Could not load the full card. Please try again.',
      }))

    this.entries.set(key, request)
    request.then(result => {
      if (result.status !== 'success') this.entries.delete(key)
    })
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value
      if (!oldest) break
      this.entries.delete(oldest)
    }
    return request
  }

  dispose() {
    this.entries.clear()
  }

  invalidate(userId: string, wordId: string) {
    const prefix = `${userId}:${wordId}:`
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key)
    }
  }
}
